# Adding New App Modules

Complete guide for adding a new automation module to the Automate project.

## Prerequisites

- Understand the [ARCHITECTURE.md](./ARCHITECTURE.md) document
- Review existing apps as references:
  - **Minimal:** [src/apps/tasks/TasksApp.tsx](../src/apps/tasks/TasksApp.tsx)
  - **Feature-rich:** [src/apps/apartment/ApartmentApp.tsx](../src/apps/apartment/ApartmentApp.tsx)

## 5-Step Checklist

### ✅ Step 1: Register in Module System

**File:** [src/config/automations.ts](../src/config/automations.ts)

Add entry to `AUTOMATIONS` array:

```typescript
{
  id: 'my-app',                    // Unique kebab-case identifier
  name: 'My App',                  // Display name
  description: 'What this app does', // Shown on home page
  icon: Icon,                      // Import from lucide-react
  route: '/my-app',                // URL path
  category: 'productivity',        // See categories below
  color: 'text-blue-400',          // Tailwind color class
  notificationKey: 'myapp',        // Optional: for notifications
  notificationDescription: 'When something happens', // Optional
}
```

**Available categories:**
- `productivity` (Tasks)
- `transport` (Public Transport)
- `travel` (Packing)
- `fitness` (Calisthenics)
- `home` (Apartment)
- `utilities`

**Import icon:**
```typescript
import { IconName } from 'lucide-react'
```

Browse icons: https://lucide.dev/icons

---

### ✅ Step 2: Create Component File

**File:** `src/apps/my-app/MyAppApp.tsx`

Use this template:

```typescript
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useActiveSpace } from '../../contexts/SpaceContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export default function MyAppApp() {
  const { activeSpaceId } = useActiveSpace();

  // Query data
  const items = useQuery(
    api.myapp.list,
    activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
  ) ?? [];

  // Mutations
  const createItem = useMutation(api.myapp.create);
  const deleteItem = useMutation(api.myapp.remove);

  // Handlers
  const handleCreate = async () => {
    if (!activeSpaceId) return;
    await createItem({ spaceId: activeSpaceId, /* fields */ });
  };

  const handleDelete = async (id: string) => {
    await deleteItem({ id });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">My App</h1>
          <p className="text-muted-foreground mt-1">
            Description of what this app does
          </p>
        </div>

        {/* Add new item form */}
        <Card className="mb-6 p-4">
          <Button onClick={handleCreate}>
            Create Item
          </Button>
        </Card>

        {/* List items */}
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No items yet. Create your first one!
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item._id} className="p-4">
                <div className="flex justify-between items-center">
                  <div>{item.name}</div>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(item._id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Key patterns:**
- Always use `activeSpaceId` from context
- Query with `'skip'` when no space selected
- Use `?? []` for list fallbacks
- Account for bottom nav with `pb-20`
- Mobile-first: default styles work on 375px width

---

### ✅ Step 3: Add Route

**File:** [src/App.tsx](../src/App.tsx)

**3a. Add lazy import at top:**
```typescript
const MyAppApp = lazy(() => import('./apps/my-app/MyAppApp'));
```

**3b. Add route inside `<Route path="/" element={<ProtectedLayout />}>`:**
```typescript
<Route path="/my-app" element={<MyAppApp />} />
```

**Full context (around line 30-50):**
```typescript
<Route path="/" element={<ProtectedLayout />}>
  <Route index element={<HomePage />} />
  <Route path="/tasks" element={<TasksApp />} />
  <Route path="/my-app" element={<MyAppApp />} />  {/* ADD HERE */}
  {/* ... other routes */}
</Route>
```

---

### ✅ Step 4: Add Database Schema

**File:** [convex/schema.ts](../convex/schema.ts)

Add table definition:

```typescript
myapp_items: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  // ... your fields
  spaceId: v.id("spaces"),       // REQUIRED for multi-tenancy
  userId: v.string(),             // Creator (Clerk user ID)
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
}).index("by_space", ["spaceId"])
  .index("by_user", ["userId"]),
```

**Important:**
- Always include `spaceId` for multi-tenancy
- Always add `by_space` index
- Use `v.optional()` for nullable fields
- Use `v.union()` for enums/status fields
- Use `v.id("table_name")` for foreign keys

**Common field types:**
```typescript
v.string()                    // Text
v.number()                    // Number
v.boolean()                   // Boolean
v.optional(v.string())        // Nullable
v.id("spaces")                // Foreign key
v.union(v.literal("a"), v.literal("b"))  // Enum
v.array(v.string())           // Array
v.object({ key: v.string() }) // Object
```

**Add notification preferences (if needed):**

In `space_members` table, update `notificationPreferences` object:
```typescript
notificationPreferences: v.object({
  tasks: v.boolean(),
  packing: v.boolean(),
  transport: v.boolean(),
  calisthenics: v.boolean(),
  apartment: v.optional(v.boolean()),
  myapp: v.optional(v.boolean()),  // ADD THIS
}),
```

---

### ✅ Step 5: Create Backend Functions

**File:** `convex/myapp.ts`

Use this template:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ============================================
// QUERIES (Read-only)
// ============================================

export const list = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("myapp_items")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .order("desc")
      .collect();

    return items;
  },
});

export const getById = query({
  args: { id: v.id("myapp_items") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// MUTATIONS (Write operations)
// ============================================

export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    name: v.string(),
    // ... your fields
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Create item
    const id = await ctx.db.insert("myapp_items", {
      ...args,
      userId: identity.subject,
      createdAt: Date.now(),
    });

    // Optional: Send notification
    // await sendNotificationToSpace(ctx, args.spaceId, "myapp", {
    //   title: "New Item Created",
    //   body: \`\${identity.name} created \${args.name}\`,
    //   data: { url: "/my-app" },
    // });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("myapp_items"),
    name: v.optional(v.string()),
    // ... fields to update
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { id, ...updates } = args;

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("myapp_items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Optional: Check ownership
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});
```

**Key patterns:**
- Always validate with `v.*` types
- Always get user identity for mutations
- Always filter by `spaceId` in queries
- Use `ctx.db.insert()`, `.patch()`, `.delete()` for writes
- Use `.withIndex()` for efficient queries

---

## Adding Notifications

If your app needs notifications:

### 1. Add notification preference to schema

Already covered in Step 4 above.

### 2. Use notification helper in backend

```typescript
import { sendNotificationToSpace } from "./notifications";

// In your mutation
await sendNotificationToSpace(ctx, spaceId, "myapp", {
  title: "Something Happened",
  body: \`\${userName} did something\`,
  icon: "/icon-192x192.png",
  tag: \`myapp-\${itemId}\`,  // For replacing old notifications
  data: {
    url: "/my-app",
    type: "myapp_event",
  },
});
```

### 3. Let users opt in/out

Notification settings are managed automatically via:
- `src/apps/library/LibraryPage.tsx` (notification settings section)
- Based on `notificationKey` in `automations.ts`

---

## Testing Your Module

### 1. Start development servers

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npx convex dev
```

### 2. Test checklist

- [ ] Module appears on home page
- [ ] Clicking card navigates to your app
- [ ] Data loads correctly
- [ ] Create/update/delete operations work
- [ ] Switching spaces shows correct data
- [ ] Mobile viewport (375px) looks good
- [ ] Notifications work (if implemented)

### 3. Test edge cases

- [ ] Empty state shows helpful message
- [ ] Loading state appears during queries
- [ ] Error handling for failed operations
- [ ] Works without network connection (offline mode)

---

## Common Patterns

### Filtering & Sorting

```typescript
const items = useQuery(
  api.myapp.list,
  activeSpaceId ? { spaceId: activeSpaceId } : 'skip'
) ?? [];

const [filter, setFilter] = useState<'all' | 'active'>('all');

const filteredItems = items.filter(item => {
  if (filter === 'active') return item.isActive;
  return true;
});

const sortedItems = filteredItems.sort((a, b) => 
  b.createdAt - a.createdAt
);
```

### Modal Pattern

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<Item | null>(null);

// In JSX
<Button onClick={() => setIsModalOpen(true)}>
  Open Modal
</Button>

{isModalOpen && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
      {/* Modal content */}
      <Button onClick={() => setIsModalOpen(false)}>Close</Button>
    </div>
  </div>
)}
```

### Authorization (Admin-only actions)

```typescript
// Backend
export const adminOnlyAction = mutation({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check admin role
    const member = await ctx.db
      .query("space_members")
      .withIndex("by_space_and_user", (q) => 
        q.eq("spaceId", args.spaceId).eq("userId", identity.subject)
      )
      .first();

    if (!member || (member.role !== "admin" && member.role !== "creator")) {
      throw new Error("Unauthorized - Admin only");
    }

    // Perform admin action
  },
});
```

### Optimistic Updates

```typescript
const [items, setItems] = useState<Item[]>([]);
const queryResult = useQuery(api.myapp.list, args) ?? [];

useEffect(() => {
  setItems(queryResult);
}, [queryResult]);

const handleToggle = async (id: string) => {
  // Optimistic update
  setItems(prev => prev.map(item => 
    item._id === id ? { ...item, isComplete: !item.isComplete } : item
  ));

  // Server update
  try {
    await toggleItem({ id });
  } catch (err) {
    // Revert on error
    setItems(queryResult);
    alert("Failed to update");
  }
};
```

---

## Troubleshooting

### Module doesn't appear on home page
- Check `AUTOMATIONS` array in `automations.ts`
- Verify `id` is unique
- Restart dev server (`npm run dev`)

### Route doesn't work
- Check lazy import path in `App.tsx`
- Verify route path matches `automations.ts` config
- Check console for import errors

### Queries return undefined
- Check `activeSpaceId` is not null
- Verify table name in schema matches query
- Check index exists in schema
- Run `npx convex dev` to deploy schema

### TypeScript errors
- Run `npx convex dev` to regenerate types
- Restart TypeScript server in VS Code
- Check imports from `_generated/api`

### Data not showing
- Check query is using correct `spaceId`
- Verify data exists in Convex dashboard
- Check browser console for errors
- Ensure `by_space` index is defined

---

## Next Steps

After creating your module:

1. **Update documentation**
   - Add to `README.md` features list
   - Update `ARCHITECTURE.md` if adding new patterns

2. **Test thoroughly**
   - Test on actual mobile device (iOS/Android)
   - Test with multiple users in same space
   - Test switching between spaces

3. **Consider enhancements**
   - Search/filter functionality
   - Sorting options
   - Export/import data
   - Sharing features

4. **Get feedback**
   - Use the app yourself for a few days
   - Ask other space members for input
   - Iterate based on real usage

---

## Need Help?

- **Architecture patterns:** [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- **Existing issues:** [BACKLOG.yaml](../BACKLOG.yaml)
- **Convex docs:** https://docs.convex.dev
- **React docs:** https://react.dev
- **Tailwind docs:** https://tailwindcss.com
