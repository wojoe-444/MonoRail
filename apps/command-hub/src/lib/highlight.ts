import core from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import dos from 'highlight.js/lib/languages/dos'
import go from 'highlight.js/lib/languages/go'
import graphql from 'highlight.js/lib/languages/graphql'
import groovy from 'highlight.js/lib/languages/groovy'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import less from 'highlight.js/lib/languages/less'
import lua from 'highlight.js/lib/languages/lua'
import makefile from 'highlight.js/lib/languages/makefile'
import markdown from 'highlight.js/lib/languages/markdown'
import mojolicious from 'highlight.js/lib/languages/mojolicious'
import perl from 'highlight.js/lib/languages/perl'
import php from 'highlight.js/lib/languages/php'
import powershell from 'highlight.js/lib/languages/powershell'
import python from 'highlight.js/lib/languages/python'
import r from 'highlight.js/lib/languages/r'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { languageFor } from '@/lib/language'

// Keep in sync with languageFor. GraphQL and Mojolicious are embedded by
// JavaScript/TypeScript and Perl. Grammars register their own aliases.
export const codeLanguages = {
  bash, c, cpp, csharp, css, diff, dockerfile, dos, go, graphql, groovy, ini, java,
  javascript, json, kotlin, less, lua, makefile, markdown, mojolicious, perl, php,
  powershell, python, r, ruby, rust, scss, sql, swift, typescript, xml, yaml,
}

const hljs = core.newInstance()
for (const [name, language] of Object.entries(codeLanguages)) hljs.registerLanguage(name, language)

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Split highlighted HTML into per-line HTML, closing and reopening spans that cross line breaks. */
export function highlightLines(code: string, path: string): string[] {
  const lang = languageFor(path)
  let html: string
  try {
    html = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : esc(code)
  } catch {
    html = esc(code)
  }
  const out: string[] = []
  const open: string[] = []
  for (const raw of html.split('\n')) {
    let line = open.join('') + raw
    for (const m of raw.matchAll(/<(\/?)span([^>]*)>/g)) {
      if (m[1]) open.pop()
      else open.push(`<span${m[2]}>`)
    }
    line += '</span>'.repeat(open.length)
    out.push(line)
  }
  if (out.length > 1 && out[out.length - 1] === '') out.pop() // trailing newline
  return out
}

