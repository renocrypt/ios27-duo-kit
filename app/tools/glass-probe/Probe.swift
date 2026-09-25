// Glass probe: a stimulus we control, drawn pixel-exact, under Liquid Glass shapes that iOS itself
// renders, so probe.ts can capture it and the numbers can calibrate our compositor. Scenes come
// from scenes.json (bundled). Launch arguments:
//   -scene <id>    a scene in scenes.json
//   -phase <n>     shifts a periodic stimulus by n / phases of its period
//   -glass 0|1     0 draws the stimulus alone (the reference capture)
// Once the scene has settled it writes Documents/ready.json: the window in points, the scale, the
// screen, and every shape resolved to a rectangle (top-left origin, points).
import SwiftUI
import UIKit

struct ProbeFile: Decodable {
  let scenes: [String: ProbeScene]
  let layouts: [String: [ProbeShape]]
}

struct ProbeScene: Decodable {
  let appearance: String?
  let phases: Int?
  let stimulus: Stimulus
  let shapes: ShapeList
}

/// A scene's shapes: a list, or the name of a shared layout.
enum ShapeList: Decodable {
  case list([ProbeShape]), layout(String)
  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if let name = try? c.decode(String.self) { self = .layout(name) } else { self = .list(try c.decode([ProbeShape].self)) }
  }
}

struct Stimulus: Decodable {
  let kind: String
  let color: String?
  let top: String?, bottom: String?
  let low: String?, high: String?, period: Double?, axis: String?
  let levels: [Double]?, tile: Double?
}

struct ProbeShape: Decodable {
  let w: Double, h: Double
  let r: Double?
  let x: Double?, y: Double?
  let glass: String?
  let tint: String?
}

/// A shape placed in the window (points, top-left origin).
struct Placed: Encodable, Identifiable {
  let id: Int
  let x: Double, y: Double, w: Double, h: Double
  let r: Double?
  let glass: String
  let tint: String?
}

typealias RGB = (Double, Double, Double)

func rgb(_ hex: String) -> RGB {
  var v: UInt64 = 0
  Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
  return (Double((v >> 16) & 255), Double((v >> 8) & 255), Double(v & 255))
}

struct Probe {
  let id: String
  let scene: ProbeScene
  let shapes: [ProbeShape]
  let phase: Int
  let glass: Bool

  static func load() -> Probe {
    let url = Bundle.main.url(forResource: "scenes", withExtension: "json")!
    let file = try! JSONDecoder().decode(ProbeFile.self, from: Data(contentsOf: url))
    let args = UserDefaults.standard
    let id = args.string(forKey: "scene") ?? "edge"
    let scene = file.scenes[id]!
    let shapes: [ProbeShape]
    switch scene.shapes {
    case .list(let list): shapes = list
    case .layout(let name): shapes = file.layouts[name]!
    }
    let glass = args.object(forKey: "glass") == nil ? true : args.bool(forKey: "glass")
    return Probe(id: id, scene: scene, shapes: shapes, phase: args.integer(forKey: "phase"), glass: glass)
  }

  var phaseFraction: Double { Double(phase) / Double(max(scene.phases ?? 1, 1)) }

  /// The tile grid for a tiles stimulus: columns, rows, and the grid's origin (points from the centre).
  func grid(_ size: CGSize) -> (cols: Int, rows: Int, x0: Double, y0: Double, tile: Double) {
    let tile = scene.stimulus.tile ?? 96
    let cols = Int(Double(size.width) / tile), rows = Int(Double(size.height) / tile)
    return (cols, rows, -Double(cols) * tile / 2, -Double(rows) * tile / 2, tile)
  }

  /// The stimulus at a point (points from the window's centre), sRGB 0...255.
  func colour(_ x: Double, _ y: Double, _ size: CGSize) -> RGB {
    let s = scene.stimulus
    switch s.kind {
    case "edge":
      return rgb(y < 0 ? s.top! : s.bottom!)
    case "sine":
      let t = s.axis == "y" ? y : x
      let v = 0.5 + 0.5 * cos(2 * Double.pi * (t / s.period! - phaseFraction))
      let lo = rgb(s.low!), hi = rgb(s.high!)
      return (lo.0 + (hi.0 - lo.0) * v, lo.1 + (hi.1 - lo.1) * v, lo.2 + (hi.2 - lo.2) * v)
    case "tiles":
      let g = grid(size)
      let c = Int(floor((x - g.x0) / g.tile)), r = Int(floor((y - g.y0) / g.tile))
      guard c >= 0, c < g.cols, r >= 0, r < g.rows, let levels = s.levels else { return rgb(s.color ?? "#808080") }
      let l = levels[(r * g.cols + c) % levels.count]
      return (l, l, l)
    default:
      return rgb(s.color ?? "#808080")
    }
  }

  /// The stimulus as a bitmap at device pixels, each pixel sampled at its centre.
  func image(_ size: CGSize, scale: CGFloat) -> CGImage {
    let w = Int((size.width * scale).rounded()), h = Int((size.height * scale).rounded())
    var bytes = [UInt8](repeating: 255, count: w * h * 4)
    let s = Double(scale), cx = Double(size.width) / 2, cy = Double(size.height) / 2
    let byte = { (v: Double) in UInt8(max(0, min(255, v.rounded()))) }
    for j in 0..<h {
      for i in 0..<w {
        let c = colour((Double(i) + 0.5) / s - cx, (Double(j) + 0.5) / s - cy, size)
        let k = (j * w + i) * 4
        bytes[k] = byte(c.0); bytes[k + 1] = byte(c.1); bytes[k + 2] = byte(c.2)
      }
    }
    let provider = CGDataProvider(data: Data(bytes) as CFData)!
    return CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4,
                   space: CGColorSpace(name: CGColorSpace.sRGB)!,
                   bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                   provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
  }

  /// Every shape placed in the window: tiles put the first shape on each tile.
  func placed(_ size: CGSize) -> [Placed] {
    let cx = Double(size.width) / 2, cy = Double(size.height) / 2
    func place(_ s: ProbeShape, _ id: Int, _ x: Double, _ y: Double) -> Placed {
      Placed(id: id, x: cx + x - s.w / 2, y: cy + y - s.h / 2, w: s.w, h: s.h, r: s.r, glass: s.glass ?? "regular", tint: s.tint)
    }
    if scene.stimulus.kind == "tiles", let s = shapes.first {
      let g = grid(size)
      return (0..<(g.cols * g.rows)).map { k in
        place(s, k, g.x0 + (Double(k % g.cols) + 0.5) * g.tile, g.y0 + (Double(k / g.cols) + 0.5) * g.tile)
      }
    }
    return shapes.enumerated().map { place($1, $0, $1.x ?? 0, $1.y ?? 0) }
  }
}

func glass(_ p: Placed) -> Glass {
  var g: Glass = p.glass == "clear" ? .clear : p.glass == "identity" ? .identity : .regular
  if let t = p.tint { let c = rgb(t); g = g.tint(Color(.sRGB, red: c.0 / 255, green: c.1 / 255, blue: c.2 / 255)) }
  return g
}

func outline(_ p: Placed) -> AnyShape {
  if let r = p.r { return AnyShape(RoundedRectangle(cornerRadius: r, style: .continuous)) }
  return AnyShape(Capsule())
}

struct ProbeView: View {
  let probe = Probe.load()
  @Environment(\.displayScale) private var scale

  var body: some View {
    GeometryReader { geo in
      let size = geo.size
      ZStack(alignment: .topLeading) {
        Image(decorative: probe.image(size, scale: scale), scale: scale)
        if probe.glass {
          ForEach(probe.placed(size)) { p in
            Color.clear
              .frame(width: p.w, height: p.h)
              .glassEffect(glass(p), in: outline(p))
              .offset(x: p.x, y: p.y)
          }
        }
      }
      .frame(width: size.width, height: size.height, alignment: .topLeading)
      .task(id: size) { await ready(size) }
    }
    .ignoresSafeArea()
    .statusBarHidden(true)
    .persistentSystemOverlays(.hidden)
    .preferredColorScheme(probe.scene.appearance == "light" ? .light : .dark)
  }

  /// Waits for the glass to settle, then reports the layout.
  private func ready(_ size: CGSize) async {
    try? await Task.sleep(for: .seconds(1.5))
    if Task.isCancelled { return }
    let screen = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen }.first
    struct Report: Encodable {
      let scene: String; let phase: Int; let glass: Bool
      let width: Double; let height: Double; let scale: Double
      let screen: [Double]; let shapes: [Placed]
    }
    let report = Report(scene: probe.id, phase: probe.phase, glass: probe.glass,
                        width: Double(size.width), height: Double(size.height), scale: Double(scale),
                        screen: [Double(screen?.bounds.width ?? 0), Double(screen?.bounds.height ?? 0)],
                        shapes: probe.placed(size))
    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    try? JSONEncoder().encode(report).write(to: dir.appendingPathComponent("ready.json"))
  }
}

@main
struct GlassProbeApp: App {
  var body: some SwiftUI.Scene {
    WindowGroup { ProbeView() }
  }
}
