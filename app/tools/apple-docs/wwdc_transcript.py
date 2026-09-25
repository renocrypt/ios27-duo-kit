# WWDC or tech-talk page (saved HTML) -> its transcript as plain text (the page's transcript section).
#   python3 wwdc_transcript.py PAGE.html > transcript.txt
import sys, re, html

def main(path):
    text = open(path, encoding='utf-8').read()
    start = text.find('id="transcript-content"')
    if start == -1:
        print("NO TRANSCRIPT FOUND")
        return
    start = text.find('>', start) + 1  # past the section's opening tag
    end = text.find('</section>', start)
    chunk = text[start:end]
    # remove span tags but keep text
    chunk = re.sub(r'<span[^>]*>', '', chunk)
    chunk = re.sub(r'</span>', '', chunk)
    chunk = re.sub(r'<p>', '\n\n', chunk)
    chunk = re.sub(r'</p>', '', chunk)
    chunk = re.sub(r'<[^>]+>', '', chunk)
    chunk = html.unescape(chunk)
    chunk = re.sub(r'[ \t]+', ' ', chunk)
    chunk = re.sub(r'\n{3,}', '\n\n', chunk)
    print(chunk.strip())

if __name__ == '__main__':
    main(sys.argv[1])
