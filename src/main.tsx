import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

// TODO: Add your Clerk publishable key to .env.local
// VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>,
)
