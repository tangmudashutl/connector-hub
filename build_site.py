# -*- coding: utf-8 -*-
"""
解析知识库中所有连接器行业文章，生成 articles.json
同时生成各篇文章的独立 HTML 页面
"""
import json
import re
import os
import shutil
from pathlib import Path
from datetime import datetime

KB = Path(r"D:\知识库\电气连接器")
OUT = Path(r"C:\Users\tangl\WorkBuddy\Claw\connector-hub")
ARTICLES_OUT = OUT / "articles"

def parse_news_md(filepath):
    """解析 06-行业新闻 下的 .md 文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    lines = text.split('\n')
    title = lines[0].replace('# ', '').strip()
    
    # Extract date from title or filename
    date_match = re.search(r'(\d{4})[-年](\d{1,2})[-月](\d{1,2})', title)
    if not date_match:
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', filepath.name)
        if date_match:
            parts = date_match.group(1).split('-')
            date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
        else:
            date = "2026-01-01"
    else:
        date = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"
    
    # Determine date range (new vs old format)
    monitoring = re.search(r'监测周期[：:]\s*(.+?)$', text, re.MULTILINE)
    week_range = ""
    if monitoring:
        week_range = monitoring.group(1).strip()
    
    # Split into articles - handle both ## N. and ### N. formats
    articles = []
    pattern = r'#{2,3} (\d+)\.\s*(.+?)\n(.+?)(?=\n#{2,3} \d+\.|\n---\n*$|\Z)'
    matches = list(re.finditer(pattern, text, re.DOTALL))
    
    for m in matches:
        num = m.group(1)
        item_title = m.group(2).strip()
        body = m.group(3).strip()
        
        # Extract fields
        item_date = date  # default to file date
        date_match2 = re.search(r'\*\*日期\*\*[：:]\s*(.+?)$', body, re.MULTILINE)
        if date_match2:
            item_date = date_match2.group(1).strip()
        
        source = re.search(r'\*\*来源\*\*[：:]\s*(.+?)$', body, re.MULTILINE)
        source = source.group(1).strip() if source else ""
        
        summary = re.search(r'\*\*摘要\*\*[：:]\s*(.+?)(?=\n\*\*|\n$|\Z)', body, re.DOTALL)
        summary = summary.group(1).strip() if summary else body[:300]
        
        link = re.search(r'\*\*(?:链接|原文链接)\*\*[：:]\s*(.+?)$', body, re.MULTILINE)
        link = link.group(1).strip() if link else ""
        
        importance = re.search(r'\*\*(?:重要性|影响)\*\*[：:]\s*(.+?)$', body, re.MULTILINE)
        importance = importance.group(1).strip() if importance else ""
        
        articles.append({
            'id': f"news_{date}_{num}",
            'title': item_title,
            'date': item_date,
            'category': '行业新闻',
            'source': source,
            'summary': summary[:500] if summary else "",
            'link': link,
            'importance': importance,
            'week_range': week_range,
            'content': body[:2000]  # truncated for JSON size
        })
    
    return title, date, articles

def parse_tech_md(filepath):
    """解析 03-技术文章 下的 .md 文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    lines = text.split('\n')
    title = lines[0].replace('# ', '').strip()
    
    # Extract metadata
    date = ""
    date_match = re.search(r'\*\*日期\*\*[：:]\s*(.+?)$', text, re.MULTILINE)
    if date_match:
        date = date_match.group(1).strip()
    
    source = re.search(r'\*\*来源\*\*[：:]\s*(.+?)$', text, re.MULTILINE)
    source = source.group(1).strip() if source else ""
    
    keywords = re.search(r'\*\*关键词\*\*[：:]\s*(.+?)$', text, re.MULTILINE)
    keywords = keywords.group(1).strip() if keywords else ""
    
    summary = re.search(r'## 摘要\s*\n(.+?)(?=\n## |\Z)', text, re.DOTALL)
    summary = summary.group(1).strip() if summary else ""
    
    return [{
        'id': f"tech_{filepath.stem}",
        'title': title,
        'date': date,
        'category': '技术文章',
        'source': source,
        'summary': summary[:500],
        'keywords': keywords,
        'link': '',
        'importance': '',
        'content': text[:3000]
    }]

def parse_mfr_md(filepath):
    """解析 01-厂家档案 下的 .md 文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    lines = text.split('\n')
    title = lines[0].replace('# ', '').strip()
    
    # Extract first paragraph as summary
    summary = ""
    for line in lines[2:]:
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('-'):
            summary = line[:300]
            break
    
    return [{
        'id': f"mfr_{filepath.stem}",
        'title': title,
        'date': '',
        'category': '厂家档案',
        'source': '',
        'summary': summary,
        'keywords': '',
        'link': '',
        'importance': '',
        'content': text[:2000]
    }]

# === MAIN ===
all_articles = []

# 1. Parse 行业新闻
news_dir = KB / "06-行业新闻"
for f in sorted(news_dir.glob("连接器行业新闻_*.md")):
    try:
        title, date, articles = parse_news_md(f)
        all_articles.extend(articles)
        print(f"✅ 行业新闻: {f.name} -> {len(articles)} articles")
    except Exception as e:
        print(f"❌ Error parsing {f.name}: {e}")

# 2. Parse 技术文章
tech_dir = KB / "03-技术文章"
for f in sorted(tech_dir.glob("*.md")):
    try:
        articles = parse_tech_md(f)
        all_articles.extend(articles)
        print(f"✅ 技术文章: {f.name}")
    except Exception as e:
        print(f"❌ Error parsing {f.name}: {e}")

# 3. Parse 厂家档案
mfr_dir = KB / "01-厂家档案"
for f in sorted(mfr_dir.glob("*.md")):
    try:
        articles = parse_mfr_md(f)
        all_articles.extend(articles)
        print(f"✅ 厂家档案: {f.name}")
    except Exception as e:
        print(f"❌ Error parsing {f.name}: {e}")

# Sort by date (newest first)
all_articles.sort(key=lambda x: x.get('date', '0000'), reverse=True)

# Write JSON
json_path = OUT / "articles.json"
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(all_articles, f, ensure_ascii=False, indent=2)

print(f"\n📊 Total articles: {len(all_articles)}")
print(f"📁 JSON written to: {json_path}")

# Stats
cats = {}
for a in all_articles:
    c = a['category']
    cats[c] = cats.get(c, 0) + 1
for c, n in cats.items():
    print(f"   {c}: {n}")

# 4. Copy cover images to articles dir
os.makedirs(ARTICLES_OUT, exist_ok=True)
img_dir = ARTICLES_OUT / "covers"
os.makedirs(img_dir, exist_ok=True)
for cover in news_dir.glob("cover_*.png"):
    shutil.copy2(cover, img_dir / cover.name)
print(f"📷 Copied {len(list(news_dir.glob('cover_*.png')))} cover images")
