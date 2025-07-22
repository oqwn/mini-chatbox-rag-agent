# RAG Tool Results

Search completed: **{TIMING_INFO}** using **{RETRIEVAL_METHOD}**

## Retrieved Content

{CONTEXT_TEXT}

## How to Use

1. **Show search transparently** using this format:
```
<details>
<summary>🔍 Search from knowledge base</summary>

**Search Details:**
- Query: [your search query]  
- Results: Found [X] documents
- Quality: [High/Medium/Low]
- Timing: {TIMING_INFO}

**Retrieved Content:**
[First few lines...]

**Evaluation:** [Is this sufficient? Need more searches?]
</details>
```

2. **Use inline citations** in your answer:
```html
<span class="citation-inline" title="Exact quote from source" data-source="1">[1]</span>
```

3. **Include references** at the end:
```
--- References ---
[1] document.pdf - Similarity: 85%
   "Exact quote used in citation..."
```

## Rules

✅ **AUTOMATICALLY** search again if results are poor - don't ask, just DO IT
✅ Search up to 3 times if needed  
✅ Base answers ONLY on retrieved content
✅ Always cite sources with [1], [2], etc.

❌ Don't make up information
❌ Don't include uncited references
❌ **NEVER** say "Let me search again" without actually searching

**CRITICAL**: If your evaluation says "insufficient", you MUST immediately perform another search in the same response!