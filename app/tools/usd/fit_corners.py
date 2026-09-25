# Fit superellipse corners ((ax-u)/ax)^n + ((ay-v)/ay)^n = 1 to measured outline points
# (u, v = insets from the two straight edges). Reports ax, ay, n and the max radial error.
import json, math
def fit(name, pts):
    best = None
    def err(ax, ay, n):
        e = 0; worst = 0
        for u, v in pts:
            if u > ax or v > ay: 
                # beyond the corner box: must lie on a straight edge (u ~ 0 or v ~ 0)
                d = min(abs(u), abs(v)); e += d * d; worst = max(worst, d); continue
            # distance proxy: solve along the ray from the superellipse centre
            X, Y = (ax - u) / ax, (ay - v) / ay
            r = (abs(X) ** n + abs(Y) ** n) ** (1 / n)
            dx, dy = (ax - u) * (1 - 1 / r), (ay - v) * (1 - 1 / r)
            d = math.hypot(dx, dy); e += d * d; worst = max(worst, d)
        return e, worst
    grid = [(ax, ay, n) for ax in [x / 20 for x in range(10, 400)] for ay in [None] for n in [2.0]]
    # coarse search, symmetric first
    best = (1e9, None)
    for ax in [x / 10 for x in range(5, 200)]:
        for n in [x / 20 for x in range(30, 90)]:
            e, w = err(ax, ax, n)
            if e < best[0]: best = (e, (ax, ax, n), w)
    ax0, _, n0 = best[1]
    for ax in [ax0 + d / 100 for d in range(-60, 61)]:
        for ay in [ax0 + d / 100 for d in range(-60, 61)]:
            for n in [n0 + d / 100 for d in range(-30, 31)]:
                if ax <= 0 or ay <= 0: continue
                e, w = err(ax, ay, n)
                if e < best[0]: best = (e, (ax, ay, n), w)
    ax, ay, n = best[1]
    print(f"{name:28s} ax {ax:.3f} ay {ay:.3f} n {n:.3f}  rms {math.sqrt(best[0]/len(pts)):.4f}  max {best[2]:.4f}  (circle-equivalent r at 45°: {ax*(1-2**(-1/n))/(1-2**-0.5):.2f})")
    return dict(ax=round(ax, 3), ay=round(ay, 3), n=round(n, 3))
frame = [(82.45, 103.122), (82.44, 103.968), (82.419, 104.771), (82.381, 105.582), (82.316, 106.397), (82.216, 107.215), (82.078, 108.034), (81.894, 108.848), (81.656, 109.653), (81.367, 110.444), (81.025, 111.216), (80.625, 111.963), (80.17, 112.68), (79.665, 113.363), (79.109, 114.006), (78.507, 114.607), (77.864, 115.162), (77.18, 115.667), (76.463, 116.121), (75.716, 116.521), (74.943, 116.863), (74.151, 117.152), (73.346, 117.39), (72.531, 117.573), (71.712, 117.712), (70.893, 117.811), (70.077, 117.876), (69.267, 117.914), (68.462, 117.935), (67.615, 117.944)]
glassFree = [(67.613, 116.612), (68.377, 116.604), (69.147, 116.586), (69.914, 116.552), (70.679, 116.495), (71.44, 116.408), (72.195, 116.284), (72.94, 116.119), (73.674, 115.909), (74.391, 115.651), (75.089, 115.344), (75.762, 114.988), (76.407, 114.582), (77.02, 114.13), (77.597, 113.634), (78.136, 113.096), (78.632, 112.52), (79.085, 111.907), (79.49, 111.263), (79.847, 110.591), (80.154, 109.893), (80.413, 109.176), (80.623, 108.443), (80.788, 107.698), (80.911, 106.943), (80.999, 106.183), (81.055, 105.433), (81.09, 104.664), (81.108, 103.883), (81.118, 102.496)]
glassHinge = [(0.957, 113.024), (0.959, 113.941), (0.968, 114.227), (0.988, 114.528), (1.031, 114.803), (1.105, 115.1), (1.206, 115.353), (1.354, 115.622), (1.518, 115.838), (1.735, 116.055), (1.951, 116.219), (2.22, 116.367), (2.474, 116.468), (2.772, 116.542), (3.047, 116.585), (3.348, 116.605), (3.634, 116.614), (4.56, 116.616)]
frameHinge = [(0.0, 116.874), (0.001, 117.082), (0.018, 117.271), (0.062, 117.424), (0.135, 117.564), (0.217, 117.67), (0.338, 117.776), (0.478, 117.857), (0.642, 117.913), (0.809, 117.942), (1.08, 117.947), (1.738, 117.948)]
plateauTop = [(77.284, 100.489), (77.385, 101.027), (77.457, 101.571), (77.5, 102.117), (77.515, 102.665), (77.501, 103.213), (77.457, 103.76), (77.385, 104.302), (77.284, 104.841), (77.155, 105.372), (76.998, 105.896), (76.814, 106.411), (76.603, 106.914), (76.365, 107.406), (76.103, 107.884), (75.815, 108.348), (75.504, 108.795), (75.17, 109.225), (74.814, 109.638), (74.436, 110.031), (74.039, 110.403), (73.622, 110.754), (73.187, 111.083), (72.734, 111.388), (72.265, 111.67), (71.781, 111.926), (71.283, 112.158), (70.772, 112.364), (70.249, 112.545), (69.714, 112.701), (69.169, 112.834), (68.614, 112.943), (68.05, 113.031), (67.477, 113.1), (66.895, 113.152), (66.306, 113.189), (65.71, 113.215), (64.806, 113.236), (63.895, 113.246), (60.119, 113.25)]
res = {}
res['frameFree'] = fit('frame free corner', [(82.45 - x, 117.948 - y) for x, y in frame])
res['glassFree'] = fit('glass free corner', [(81.118 - x, 116.616 - y) for x, y in glassFree])
res['glassHinge'] = fit('glass hinge corner', [(x - 0.957, 116.616 - y) for x, y in glassHinge])
res['frameHinge'] = fit('frame hinge corner (mid)', [(x, 117.948 - y) for x, y in frameHinge])
res['plateauTop'] = fit('plateau top end (upper half)', [(77.515 - x, 113.25 - y) for x, y in plateauTop if y >= 102.665])
json.dump(res, open('/tmp/duo/geometry/corner-fits.json', 'w'), indent=1)

# Plateau end as one half superellipse spanning the full height (no straight segment on the end).
def fit_end(pts, hh, xe, yc):
    best = (1e9, None, 0)
    for ax in [x / 20 for x in range(160, 360)]:
        for n in [x / 50 for x in range(100, 200)]:
            e = 0; w = 0
            for x, y in pts:
                X = (x - (xe - ax)) / ax; Y = (y - yc) / hh
                if X < 0: d = abs(abs(y - yc) - hh)
                else:
                    r = (abs(X) ** n + abs(Y) ** n) ** (1 / n)
                    d = math.hypot((x - (xe - ax)) * (1 - 1 / r), (y - yc) * (1 - 1 / r))
                e += d * d; w = max(w, d)
            if e < best[0]: best = (e, (ax, n), w)
    ax, n = best[1]
    print(f"plateau end half-superellipse: ax {ax:.3f} ay {hh:.3f} n {n:.3f} rms {math.sqrt(best[0]/len(pts)):.4f} max {best[2]:.4f}")
fit_end(plateauTop, 10.585, 77.515, 102.665)
