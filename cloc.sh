#!/bin/bash

# Check if cloc is installed
if ! command -v cloc &> /dev/null; then
    echo "Error: cloc is not installed."
    echo ""
    echo "To install cloc, run:"
    echo "  brew install cloc"
    echo ""
    echo "For more information, visit: https://github.com/AlDanial/cloc"
    exit 1
fi

# Check if any arguments were provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <path1> [path2] [path3] ..."
    echo "Example: $0 laravel/**/Routing"
    exit 1
fi

# Check if we should expand the single argument as a pattern
if [ $# -eq 1 ] && [ ! -e "$1" ]; then
    # Single argument that doesn't exist - try to find directories with this name
    echo "Expanding $1 as laravel/**/$1"
    
    # Use find to locate all directories matching the pattern
    found_dirs=()
    while IFS= read -r -d '' dir; do
        found_dirs+=("$dir")
    done < <(find laravel -type d -name "$1" -print0 2>/dev/null)
    
    if [ ${#found_dirs[@]} -eq 0 ]; then
        echo "No matches found for pattern: laravel/**/$1"
        exit 1
    fi
    
    # Process each found directory
    for dir in "${found_dirs[@]}"; do
        # Display the path with blue background and white text
        echo "$(tput setaf 7)$(tput setab 4)$dir$(tput sgr0)"
        
        # Run cloc and filter output
        cloc --include-lang=PHP --quiet "$dir" | grep -E '^(Language|PHP)'
    done
    
    # If multiple directories were found, show a total
    if [ ${#found_dirs[@]} -gt 1 ]; then
        echo "$(tput setaf 7)$(tput setab 4)TOTAL$(tput sgr0)"
        cloc --include-lang=PHP --quiet "${found_dirs[@]}" | grep -E '^(Language|PHP)'
    fi
else
    # Process each path argument normally
    for path in "$@"; do
        # Display the path with blue background and white text
        echo "$(tput setaf 7)$(tput setab 4)$path$(tput sgr0)"
        
        # Run cloc and filter output
        cloc --include-lang=PHP --quiet "$path" | grep -E '^(Language|PHP)'
    done
fi