import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

const C = {
  text:        'rgba(226,232,240,0.95)',
  bold:        '#f1f5f9',
  h1:          '#a78bfa',
  h2:          '#7dd3fc',
  h3:          '#86efac',
  italic:      '#fbbf24',
  code:        '#a78bfa',
  codeBg:      'rgba(124,58,237,0.18)',
  blockBg:     'rgba(124,58,237,0.1)',
  blockBorder: '#7c3aed',
  bullet:      '#a78bfa',
  number:      '#7dd3fc',
  tableHead:   '#a78bfa',
  tableHeadBg: 'rgba(124,58,237,0.25)',
  tableBorder: 'rgba(124,58,237,0.3)',
  tableRow:    'rgba(226,232,240,0.85)',
  tableRowAlt: 'rgba(15,23,42,0.6)',
  hr:          'rgba(124,58,237,0.35)',
  link:        '#38bdf8',
};

// Parse inline styles: **bold**, *italic*, `code`, ~~strike~~
function parseInline(text, baseStyle) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={key++} style={baseStyle}>{text.slice(last, match.index)}</Text>);
    }
    if (match[2]) {
      parts.push(<Text key={key++} style={[baseStyle, ms.bold]}>{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={key++} style={[baseStyle, ms.italic]}>{match[3]}</Text>);
    } else if (match[4]) {
      parts.push(<Text key={key++} style={ms.inlineCode}>{match[4]}</Text>);
    } else if (match[5]) {
      parts.push(<Text key={key++} style={[baseStyle, ms.strike]}>{match[5]}</Text>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(<Text key={key++} style={baseStyle}>{text.slice(last)}</Text>);
  }

  return parts.length > 0 ? parts : [<Text key={0} style={baseStyle}>{text}</Text>];
}

// Parse a markdown table
function parseTable(lines) {
  const rows = lines.map(l => l.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1));
  const header = rows[0];
  const body = rows.slice(2); // skip separator row
  return { header, body };
}

export default function MarkdownView({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <View key={key++} style={ms.codeBlock}>
          {lang ? <Text style={ms.codeLang}>{lang}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={ms.codeText}>{codeLines.join('\n')}</Text>
          </ScrollView>
        </View>
      );
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const { header, body } = parseTable(tableLines);
      elements.push(
        <ScrollView key={key++} horizontal showsHorizontalScrollIndicator={false} style={ms.tableWrap}>
          <View style={ms.table}>
            <View style={ms.tableHeadRow}>
              {header.map((h, ci) => (
                <View key={ci} style={ms.th}>
                  <Text style={ms.thText}>{h}</Text>
                </View>
              ))}
            </View>
            {body.map((row, ri) => (
              <View key={ri} style={[ms.tr, ri % 2 === 1 && ms.trAlt]}>
                {row.map((cell, ci) => (
                  <View key={ci} style={ms.td}>
                    <Text style={ms.tdText}>{cell}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
      continue;
    }

    // H1
    if (line.startsWith('# ')) {
      elements.push(<Text key={key++} style={ms.h1}>{line.slice(2)}</Text>);
      i++; continue;
    }
    // H2
    if (line.startsWith('## ')) {
      elements.push(<Text key={key++} style={ms.h2}>{line.slice(3)}</Text>);
      i++; continue;
    }
    // H3
    if (line.startsWith('### ')) {
      elements.push(<Text key={key++} style={ms.h3}>{line.slice(4)}</Text>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <View key={key++} style={ms.blockquote}>
          <Text style={ms.blockquoteText}>{line.slice(2)}</Text>
        </View>
      );
      i++; continue;
    }

    // HR
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push(<View key={key++} style={ms.hr} />);
      i++; continue;
    }

    // Bullet list
    if (line.match(/^[-*+] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <View key={key++} style={ms.list}>
          {items.map((item, idx) => (
            <View key={idx} style={ms.listItem}>
              <Text style={ms.bullet}>•</Text>
              <Text style={ms.listText}>{parseInline(item, ms.listText)}</Text>
            </View>
          ))}
        </View>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items = [];
      let num = 1;
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      elements.push(
        <View key={key++} style={ms.list}>
          {items.map((item, idx) => (
            <View key={idx} style={ms.listItem}>
              <Text style={ms.number}>{idx + 1}.</Text>
              <Text style={ms.listText}>{parseInline(item, ms.listText)}</Text>
            </View>
          ))}
        </View>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<View key={key++} style={{ height: 6 }} />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(
      <Text key={key++} style={ms.p}>
        {parseInline(line, ms.p)}
      </Text>
    );
    i++;
  }

  return <View style={ms.root}>{elements}</View>;
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const ms = StyleSheet.create({
  root: { flexShrink: 1 },
  p:    { color: C.text, fontSize: 14, lineHeight: 22, marginBottom: 4 },
  bold: { color: C.bold, fontWeight: '800' },
  italic: { color: C.italic, fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through', color: 'rgba(226,232,240,0.5)' },

  h1: { color: C.h1, fontSize: 18, fontWeight: '800', marginTop: 10, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(124,58,237,0.3)', paddingBottom: 4 },
  h2: { color: C.h2, fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  h3: { color: C.h3, fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 3 },

  inlineCode: { color: C.code, backgroundColor: C.codeBg, borderRadius: 4, paddingHorizontal: 5, fontSize: 13, fontFamily: MONO },
  codeBlock:  { backgroundColor: 'rgba(15,23,42,0.95)', borderRadius: 10, padding: 12, marginVertical: 8, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  codeLang:   { color: '#a78bfa', fontSize: 10, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  codeText:   { color: '#86efac', fontSize: 13, fontFamily: MONO, lineHeight: 20 },

  blockquote:     { backgroundColor: C.blockBg, borderLeftWidth: 3, borderLeftColor: C.blockBorder, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 6, borderRadius: 4 },
  blockquoteText: { color: 'rgba(226,232,240,0.8)', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },

  hr: { height: 1, backgroundColor: C.hr, marginVertical: 10 },

  list:     { marginVertical: 4 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  bullet:   { color: C.bullet, fontSize: 16, lineHeight: 22, width: 14 },
  number:   { color: C.number, fontSize: 14, fontWeight: '700', lineHeight: 22, minWidth: 20 },
  listText: { color: C.text, fontSize: 14, lineHeight: 22, flex: 1 },

  tableWrap:    { marginVertical: 8 },
  table:        { borderWidth: 1, borderColor: C.tableBorder, borderRadius: 8, overflow: 'hidden' },
  tableHeadRow: { flexDirection: 'row', backgroundColor: C.tableHeadBg },
  th:           { minWidth: 80, padding: 8, borderRightWidth: 1, borderRightColor: C.tableBorder },
  thText:       { color: C.tableHead, fontWeight: '700', fontSize: 13 },
  tr:           { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(124,58,237,0.15)' },
  trAlt:        { backgroundColor: 'rgba(124,58,237,0.05)' },
  td:           { minWidth: 80, padding: 8, borderRightWidth: 1, borderRightColor: 'rgba(124,58,237,0.1)' },
  tdText:       { color: C.tableRow, fontSize: 13, lineHeight: 18 },
});
