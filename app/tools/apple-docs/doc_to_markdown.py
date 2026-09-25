# Apple documentation page (DocC render JSON) -> Markdown: headings, emphasis, code, image alt text,
# topic links with their abstracts. See README.md for where the JSON comes from.
#   python3 doc_to_markdown.py PAGE.json [OUT.md]     (stdout without OUT.md)
import json, sys

def load(path):
    return json.load(open(path))

def make_inline_text(refs):
    def inline_text(items):
        out = []
        for node in items:
            t = node.get('type')
            if t == 'text':
                out.append(node['text'])
            elif t == 'codeVoice':
                out.append('`'+node['code']+'`')
            elif t == 'reference':
                ident = node['identifier']
                r = refs.get(ident, {})
                title = r.get('title') or ident
                out.append(f'[{title}]({ident})')
            elif t == 'strong':
                out.append('**'+inline_text(node.get('inlineContent',[]))+'**')
            elif t == 'emphasis':
                out.append('*'+inline_text(node.get('inlineContent',[]))+'*')
            elif t == 'image':
                ident = node.get('identifier')
                r = refs.get(ident, {})
                alt = r.get('alt') or '(no alt text)'
                out.append(f'\n![IMAGE: {alt}]\n')
            else:
                if 'inlineContent' in node:
                    out.append(inline_text(node['inlineContent']))
                else:
                    out.append(f'[UNK-INLINE:{t}]')
        return ''.join(out)
    return inline_text

def render(d, content_blocks, refs):
    inline_text = make_inline_text(refs)
    lines = []
    def render_block(block, depth=0):
        indent = '  '*depth
        t = block.get('type')
        if t == 'heading':
            lvl = block.get('level',2)
            anchor = block.get('anchor','')
            lines.append(f"\n{'#'*lvl} {block.get('text','')}  {{#{anchor}}}\n")
        elif t == 'paragraph':
            lines.append(indent+inline_text(block.get('inlineContent',[])))
        elif t == 'unorderedList':
            for item in block.get('items',[]):
                for c in item.get('content',[]):
                    before = len(lines)
                    render_block(c, depth+1)
                    for i in range(before, len(lines)):
                        if not lines[i].startswith('\n'):
                            lines[i] = indent+'- '+lines[i].strip()
        elif t == 'orderedList':
            for i,item in enumerate(block.get('items',[]),1):
                for c in item.get('content',[]):
                    before = len(lines)
                    render_block(c, depth+1)
                    for j in range(before, len(lines)):
                        if not lines[j].startswith('\n'):
                            lines[j] = indent+f'{i}. '+lines[j].strip()
        elif t == 'termList':
            for item in block.get('items',[]):
                term = inline_text(item.get('term',{}).get('inlineContent',[]))
                lines.append(f"{indent}- **{term}**:")
                for c in item.get('definition',{}).get('content',[]):
                    render_block(c, depth+1)
        elif t == 'aside':
            style = block.get('style','note')
            lines.append(f"\n> **{style.upper()}**")
            for c in block.get('content',[]):
                before = len(lines)
                render_block(c, depth+1)
        elif t == 'tabNavigator':
            lines.append(f"\n[TAB NAVIGATOR: {block.get('anchor','')}]")
            for tab in block.get('tabs',[]):
                lines.append(f"\n--- TAB: {tab.get('title','')} ---")
                for c in tab.get('content',[]):
                    render_block(c, depth+1)
        elif t == 'table':
            rows = block.get('rows',[])
            lines.append("\n[TABLE]")
            for row in rows:
                cells=[]
                for cell in row:
                    sub_before = len(lines)
                    for c in cell:
                        render_block(c, depth)
                    cells.append(' '.join(lines[sub_before:]))
                    del lines[sub_before:]
                lines.append(' | '.join(cells))
        elif t == 'links':
            for item in block.get('items',[]):
                r = refs.get(item, {})
                title = r.get('title') or item
                lines.append(f"- LINK: [{title}]({item})")
        elif t == 'image':
            ident = block.get('identifier')
            r = refs.get(ident, {})
            alt = r.get('alt') or '(no alt)'
            lines.append(f"\n![IMAGE: {alt}]\n")
        elif t == 'codeListing':
            code = '\n'.join(block.get('code',[]))
            lines.append(f"\n```{block.get('syntax','')}\n{code}\n```\n")
        elif t == 'declarations':
            for decl in block.get('declarations',[]):
                toks = ''.join(tok.get('text','') for tok in decl.get('tokens',[]))
                plats = ', '.join(decl.get('platforms',[]))
                lines.append(f"\n**Declaration** ({plats}): `{toks}`\n")
        elif t == 'content':
            for c in block.get('content',[]):
                render_block(c, depth)
        else:
            lines.append(f"[UNHANDLED:{t}] {json.dumps(block)[:200]}")
    for b in content_blocks:
        render_block(b, 0)
    return '\n'.join(lines)

def render_doc(d):
    refs = d.get('references', {})
    out = []
    out.append(f"# {d.get('metadata',{}).get('title','')}\n")
    abstract = d.get('abstract')
    if abstract:
        inline_text = make_inline_text(refs)
        out.append("**Abstract:** " + inline_text(abstract) + "\n")
    for sec in d.get('primaryContentSections', []):
        kind = sec.get('kind')
        if kind == 'declarations':
            out.append(render(d, [sec], refs))
        elif kind == 'content':
            out.append(render(d, sec.get('content', []), refs))
        else:
            out.append(render(d, [sec], refs))
    # topic sections (members / related symbols)
    topic_secs = d.get('topicSections') or []
    if topic_secs:
        out.append("\n## Topics (members/related)\n")
        for ts in topic_secs:
            out.append(f"### {ts.get('title','')}")
            for ident in ts.get('identifiers', []):
                r = refs.get(ident, {})
                title = r.get('title') or ident
                frag = r.get('fragments')
                fragtext = ''
                if frag:
                    fragtext = ' `' + ''.join(f.get('text','') for f in frag) + '`'
                abst = r.get('abstract')
                abst_text = ''
                if abst:
                    abst_text = ' — ' + make_inline_text(refs)(abst)
                out.append(f"- **{title}**{fragtext}{abst_text}")
    return '\n'.join(out)

if __name__ == '__main__':
    path = sys.argv[1]
    outpath = sys.argv[2] if len(sys.argv) > 2 else None
    d = load(path)
    text = render_doc(d)
    if outpath:
        with open(outpath, 'w') as f:
            f.write(text)
        print(f"wrote {len(text)} chars to {outpath}")
    else:
        print(text)
