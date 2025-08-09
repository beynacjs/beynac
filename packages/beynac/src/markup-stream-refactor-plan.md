# MarkupStream Refactoring Plan

## Overview
This document captures the refactoring plan for the `MarkupStream.renderChunks()` method to unify synchronous and asynchronous rendering paths.

## Refactoring Goals
1. Replace iterator-based approach with position-based tree traversal
2. Unify synchronous and asynchronous rendering paths
3. Improve state management during async operations
4. Simplify the overall rendering logic

## Key Design Components

### 1. Position Stack (Integer Array)
- Maintains current position in content tree as array of integers
- Each integer represents the index at the current depth level
- Example: `[2, 0, 3]` means: root's 3rd child → its 1st child → its 4th child
- Enables resuming traversal after async operations without losing position

### 2. Buffer Object
- Type: `{ value: string }`
- Allows buffer modification within closures and async callbacks
- Accumulates rendered HTML until async operation encountered

### 3. Content Flattening
- Arrays passed to constructor are immediately flattened recursively
- Ensures most indices remain stable during traversal
- Exception: Promise resolution can introduce arrays requiring special handling

### 4. Unified Rendering Flow
The `continueRendering()` helper method:
1. Traverses tree using position stack
2. Renders synchronous content directly to buffer
3. When hitting async content:
   - Returns current buffer content as first chunk element
   - Creates promise that waits for async content
   - Resumes from exact same position after resolution
4. Handles two async content types:
   - `Promise<Content>`: Child promises needing resolution
   - `MarkupStream` with `resolvePromise`: Streams waiting for children

### 5. Tree Traversal Logic
- Start at root (empty position stack)
- Process current node based on type
- For container nodes (MarkupStream), push 0 to stack to enter children
- Increment last stack position to move to next sibling
- Pop from stack when all siblings processed (return to parent)

## Implementation Details

### Promise-to-Array Expansion
When a promise resolves to an array, it must be spliced into the parent array:
```typescript
if (child instanceof Promise) {
    const currentChunk = buffer.value;
    return [
        currentChunk,
        child.then((resolved) => {
            if (parent && Array.isArray(resolved)) {
                // Splice array into parent
                parent.splice(index, 1, ...resolved);
            } else if (parent) {
                // Simple replacement
                parent[index] = resolved;
            }
            buffer.value = "";
            // Continue from same position
            return continueRendering();
        }),
    ];
}
```

### Closing Tag Management
Need to properly track when to emit closing tags:
- After processing all children of a MarkupStream
- Handle both sync and async cases
- Ensure tags are closed in correct order

### Edge Cases to Handle
1. Empty content arrays
2. Deeply nested promises
3. MarkupStream with async children containing more MarkupStreams
4. Promise resolving to null/undefined
5. Promise resolving to array containing more promises

## Testing Requirements
1. Test synchronous rendering
2. Test async rendering with promises
3. Test mixed sync/async content
4. Test promise-to-array expansion
5. Test deeply nested structures
6. Test error handling in promises
7. Verify correct HTML output and tag ordering

## Progress Tracking
- [x] Basic position stack implementation
- [x] Buffer object implementation
- [x] Content flattening in constructor
- [x] Basic tree traversal
- [x] Synchronous content rendering
- [x] Basic async handling
- [x] Promise-to-array expansion
- [x] Proper closing tag management
- [x] Comprehensive test coverage (all 30 tests passing)
- [x] Edge case handling
- [x] Eliminated duplication in rendering logic (single helper for opening/closing tags)