# Apple documentation tools

Converters for reading Apple's design and developer documentation as text, so research notes can quote and cite it (`docs/research/`). What they read and write is Apple's text: it stays outside the project, in `/tmp/duo/` (`duo-hig/raw/`, `liquid-glass-research/apple/`), and only numbers, descriptions, and citations come in. Rerun them when the HIG changes (the notes record the date they were checked).

| Script | What it does |
| --- | --- |
| `doc_to_markdown.py PAGE.json [OUT.md]` | An Apple documentation page to Markdown. Pages are DocC render JSON at `https://developer.apple.com/tutorials/data/<path>.json`, for example `design/human-interface-guidelines/materials` or `documentation/swiftui/...` |
| `wwdc_transcript.py PAGE.html` | A WWDC or tech-talk page, saved as HTML, to its transcript |

Plain Python 3, no dependencies.

    curl -s https://developer.apple.com/tutorials/data/design/human-interface-guidelines/materials.json -o /tmp/duo/duo-hig/raw/materials.json
    python3 doc_to_markdown.py /tmp/duo/duo-hig/raw/materials.json /tmp/duo/duo-hig/raw/materials.rendered.md
