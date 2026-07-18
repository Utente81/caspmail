import os
import re

wf_dir = '/home/ubuntu/caspmail/new/.github/workflows'
for filename in os.listdir(wf_dir):
    if filename.endswith('.yml'):
        filepath = os.path.join(wf_dir, filename)
        with open(filepath, 'r') as f:
            content = f.read()

        # Handle case where `with:` already exists
        def replacer_with_existing(match):
            indent = match.group(1)
            # Match is: indent + "uses: actions/checkout@v4...\n" + indent + "with:"
            full_match = match.group(0)
            if 'persist-credentials: false' in content[match.end():match.end()+100]:
                return full_match
            return f"{full_match}\n{indent}  persist-credentials: false"
            
        content = re.sub(r'^(\s*)uses: actions/checkout@[^\n]+\n\1with:', replacer_with_existing, content, flags=re.MULTILINE)

        # Handle case where `with:` does NOT exist
        def replacer_no_with(match):
            indent = match.group(1)
            full_match = match.group(0)
            return f"{full_match}\n{indent}with:\n{indent}  persist-credentials: false"
            
        # Negative lookahead for \n\s*with:
        content = re.sub(r'^(\s*)uses: actions/checkout@[^\n]+(?!\n\s*with:)', replacer_no_with, content, flags=re.MULTILINE)

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filename}")
