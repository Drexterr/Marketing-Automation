# Fix Frontend Build - Missing Textarea Component

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the frontend build failure by creating the missing `textarea.tsx` UI component and verifying all dependencies.

**Architecture:** Create a reusable `Textarea` component using React forwardRef and Tailwind CSS, following the project's shadcn-like UI component pattern.

**Tech Stack:** React, Next.js, Tailwind CSS, Lucide React (if needed), clsx/tailwind-merge (via `cn` utility).

---

### Task 1: Create Textarea Component

**Files:**
- Create: `frontend/components/ui/textarea.tsx`

- [ ] **Step 1: Write the Textarea component code**

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        ...props
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

- [ ] **Step 2: Verify file creation**

Run: `ls frontend/components/ui/textarea.tsx`
Expected: File exists.

### Task 2: Verify UI Component Dependencies

**Files:**
- Check: `frontend/components/ui/label.tsx`
- Check: `frontend/components/ui/progress.tsx`
- Check: `frontend/components/ui/switch.tsx`

- [ ] **Step 1: Verify all required UI components exist**

Already checked via `list_directory`:
- `label.tsx`: EXISTS
- `progress.tsx`: EXISTS
- `switch.tsx`: EXISTS

- [ ] **Step 2: Verify `cn` utility exists**

Check: `frontend/lib/utils.ts`

### Task 3: Build and Verify

**Files:**
- N/A

- [ ] **Step 1: Install dependencies (if needed)**

Run: `cd frontend; npm install`

- [ ] **Step 2: Run build**

Run: `cd frontend; npm run build`
Expected: Build succeeds without "missing textarea" error.

- [ ] **Step 3: Commit changes**

```bash
git add frontend/components/ui/textarea.tsx
git commit -m "fix(frontend): add missing textarea component to fix build failure"
```
