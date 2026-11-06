# Cuts the site chrome (head, nav, menu, footer, scripts) out of a case-study page into raw chunks for the blog layout.
# Re-run it after the main site's shared CSS/JS changes to bring the blog in line:  python3 scripts/extract-layout.py
import re
html=open('../work/hotplate/index.html').read()

def between(s,a,b,incl_a=False,incl_b=False):
    i=s.index(a); j=s.index(b,i+len(a))
    return s[(i if incl_a else i+len(a)):(j+len(b) if incl_b else j)]

# head: everything from <meta charset> to the seo block, minus <title>/<base>
head=between(html,'<head>','<!-- seo:start -->')
head=re.sub(r'\s*<title>.*?</title>','',head,flags=re.S)
head=re.sub(r'\s*<base href="[^"]*"\s*/?>','',head)
head=re.sub(r'\s*<meta name="description"[^>]*>','',head)

# top: skip link, page wrapper, nav and the opening <main>
top=between(html,'<a class="skip-link"','<main id="main" tabindex="-1">',incl_a=True,incl_b=True)
top=top.replace('href="work/hotplate/#contact"','href="#contact"')
top=re.sub(r'href="[^"#]*#contact"','href="#contact"',top)

# bottom: footer .. </main>, page wrapper close, menu + cursor, then every script
foot=between(html,'<footer class="footer"','</main>',incl_a=True,incl_b=True)
rest=html[html.index('</main>')+len('</main>'):]
page_close=rest[:rest.index('<!-- /.page -->')+len('<!-- /.page -->')]
menu=between(rest,'<!-- Menu','</nav>',incl_a=True,incl_b=True)
cursor=between(rest,'<!-- Osmo Supply','</div>\n  </div>',incl_a=True,incl_b=True) if '<!-- Osmo Supply' in rest else ''
scripts=rest[rest.index('<script>',rest.index('</dialog>') if '</dialog>' in rest else 0):rest.rindex('</body>')]
bottom='\n'.join([foot,page_close,menu,cursor,scripts]).replace('src="arc.js?v=9"','src="/arc.js?v=9"')
open('src/layouts/chunks/head.html','w').write(head)
open('src/layouts/chunks/top.html','w').write(top)
open('src/layouts/chunks/bottom.html','w').write(bottom)
print(len(head),len(top),len(bottom))
