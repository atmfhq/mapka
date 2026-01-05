# SquadMap Tactical - Codebase Overview & Migration Guide

## Project Overview

**SquadMap Tactical** (also branded as "Mapka") is a real-time social mapping application that enables users to discover events, connect with nearby people, and organize activities in their area. The application combines location-based services, real-time communication, and event management in a tactical/gaming-inspired interface.

### Core Features

1. **Interactive Map Interface**
   - Mapbox-powered interactive map
   - Real-time user location tracking
   - User markers with custom avatars
   - Event/quest markers
   - Shout markers (location-based messages)
   - Date-based event filtering

2. **User Management**
   - Authentication via Supabase Auth
   - Custom avatar builder system
   - User profiles with locations
   - Guest mode for browsing
   - Ghost mode for privacy

3. **Events & Quests**
   - Create and manage events (called "megaphones" or "quests")
   - Event categories and activities
   - Event participants tracking
   - Event lobbies with chat
   - Share codes for events
   - Official event deployment

4. **Communication**
   - Direct messaging between users
   - Event/spot chat
   - Shouts (location-based public messages)
   - Real-time typing indicators
   - Message reactions
   - Read receipts and unread counts

5. **Social Features**
   - User connections/follows
   - Notifications system
   - Activity tracking
   - Interest-based matching
   - Admin capabilities

6. **PWA Support**
   - Progressive Web App functionality
   - Offline capabilities
   - Install prompts
   - Service worker for caching

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Framework**: 
  - shadcn/ui components
  - Radix UI primitives
  - Tailwind CSS for styling
  - Lucide React icons
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query) for server state
- **Backend**: Supabase
  - Authentication
  - PostgreSQL database
  - Real-time subscriptions
  - Edge Functions (Deno)
- **Maps**: Mapbox GL JS
- **Form Management**: React Hook Form + Zod validation
- **Date Handling**: date-fns

## Project Structure

```
squadmap-tactical/
├── src/
│   ├── components/          # React components
│   │   ├── avatar/          # Avatar builder and display
│   │   ├── map/             # Map-related components (TacticalMap, markers, modals)
│   │   └── ui/              # shadcn/ui components
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # External service integrations
│   │   └── supabase/        # Supabase client and types
│   ├── pages/               # Route pages (Dashboard, Auth, etc.)
│   ├── utils/               # Utility functions
│   ├── constants/           # Constants and configuration
│   ├── config/              # Configuration files
│   ├── lib/                 # Library utilities
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── generate-og-image/  # OG image generation
│   │   └── og-share/           # Social media sharing handler
│   ├── migrations/          # Database migrations
│   └── config.toml          # Supabase configuration
├── public/                  # Static assets
│   └── assets/              # Images, cursors, avatars
└── [config files]           # Vite, TypeScript, Tailwind, etc.
```

## Key Components

### Core Pages
- **Dashboard** (`src/pages/Dashboard.tsx`): Main application page with map and navigation
- **Auth** (`src/pages/Auth.tsx`): Authentication page (legacy, now modal-based)
- **Onboarding** (`src/pages/Onboarding.tsx`): User onboarding flow (legacy, now modal-based)

### Map Components
- **TacticalMap** (`src/components/map/TacticalMap.tsx`): Main map component with all marker logic
- **UserMarker**: Individual user markers on map
- **ShoutMarker**: Location-based message markers
- **Navbar**: Top navigation bar
- **BottomNav**: Mobile bottom navigation
- **GuestNavbar**: Navigation for guest users

### Modals & Drawers
- **AuthModal**: Authentication modal
- **ProfileModal**: User profile viewer
- **EditProfileModal**: Profile editing
- **ShoutModal**: Create/view shouts
- **DeployQuestModal**: Create events/quests
- **QuestLobby**: Event lobby with participants
- **ChatDrawer**: Chat interface
- **ConnectionsDrawer**: User connections list

## Environment Variables

The application requires the following environment variables:

### Required for Frontend (Vite)
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon/public key
- `VITE_MAPBOX_TOKEN`: Mapbox access token for maps

### Required for Supabase Edge Functions
These are automatically set by Supabase, but you may need them for local testing:
- `SUPABASE_URL`: Supabase project URL (set automatically)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (set automatically)
- `VITE_MAPBOX_TOKEN`: Mapbox token (must be set manually in Supabase dashboard)

### For Production Deployment
- `APP_BASE_URL`: Base URL of your deployed application (for OG sharing)

## Migration from Lovable: Step-by-Step Guide

This project was originally built in Lovable.dev. Follow these steps to disconnect from Lovable and set up local development:

### Step 1: Remove Lovable Dependencies

1. **Remove `lovable-tagger` package**
   - The package is only used in development for component tagging
   - It's already removed from the code (see changes made)

2. **Remove Lovable references from code**
   - ✅ `vite.config.ts`: Remove `lovable-tagger` import and usage
   - ✅ `package.json`: Remove `lovable-tagger` from devDependencies

### Step 2: Update Hardcoded URLs

1. **Update Supabase Edge Function**
   - The `og-share` function has a hardcoded Lovable URL
   - ✅ Updated to use environment variable `APP_BASE_URL`
   - Set this variable in your Supabase project settings or deployment environment

### Step 3: Set Up Environment Variables

1. **Create `.env` file** (copy from `.env.example`)
   ```bash
   cp .env.example .env
   ```

2. **Fill in your values**:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   VITE_MAPBOX_TOKEN=your-mapbox-token
   ```

3. **Get your Supabase credentials**:
   - Go to your Supabase project dashboard
   - Settings → API
   - Copy the Project URL and anon/public key

4. **Get your Mapbox token**:
   - Sign up/login at [mapbox.com](https://mapbox.com)
   - Go to Account → Access tokens
   - Create a new token or use your default public token

### Step 4: Install Dependencies

```bash
# Using npm
npm install

# Or using yarn
yarn install

# Or using pnpm
pnpm install

# Or using bun (if you have bun.lockb)
bun install
```

### Step 5: Set Up Supabase (if not already done)

1. **Install Supabase CLI** (optional, for local development):
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Set environment variables for Edge Functions** (if deploying):
   - Go to Supabase Dashboard → Edge Functions → Settings
   - Add environment variables:
     - `APP_BASE_URL`: Your production URL
     - `VITE_MAPBOX_TOKEN`: Your Mapbox token

### Step 6: Run the Development Server

```bash
npm run dev
```

The application will start at `http://localhost:8080` (or the port specified in `vite.config.ts`).

### Step 7: Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Step 8: Preview Production Build (Optional)

```bash
npm run preview
```

## Database Setup

The project uses Supabase PostgreSQL database with migrations in `supabase/migrations/`. 

**Note**: If you're connecting to an existing Supabase project, the migrations should already be applied. If starting fresh:

1. Review migrations in `supabase/migrations/`
2. Apply them to your database via Supabase dashboard or CLI
3. Ensure all required tables, functions, and policies are set up

## Additional Configuration

### Mapbox Setup

1. Create a Mapbox account at [mapbox.com](https://mapbox.com)
2. Get your access token from the Account page
3. Add it to your `.env` file as `VITE_MAPBOX_TOKEN`
4. Configure token scopes (typically only needs public scopes for client-side usage)

### Supabase Edge Functions

The project includes two Edge Functions:

1. **generate-og-image**: Generates Open Graph images for social sharing
2. **og-share**: Handles social media crawler requests and redirects

To deploy these functions:

```bash
supabase functions deploy generate-og-image
supabase functions deploy og-share
```

Make sure to set the required environment variables in the Supabase dashboard.

## Development Tips

1. **Hot Module Replacement**: Vite provides fast HMR - changes reflect immediately
2. **TypeScript**: The project uses strict TypeScript - check types before committing
3. **Linting**: Run `npm run lint` to check code quality
4. **Real-time Features**: Uses Supabase real-time subscriptions - ensure your Supabase project has real-time enabled
5. **PWA**: The app is a PWA - test install functionality and offline capabilities

## Common Issues & Solutions

### Issue: Map not loading
- **Solution**: Check that `VITE_MAPBOX_TOKEN` is set correctly in `.env`
- Verify the token has the correct scopes in Mapbox dashboard

### Issue: Supabase connection errors
- **Solution**: Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct
- Check that your Supabase project is active and accessible
- Ensure your IP is allowed in Supabase dashboard (if using IP restrictions)

### Issue: Environment variables not loading
- **Solution**: Restart the dev server after changing `.env` files
- Ensure variables are prefixed with `VITE_` for Vite to expose them
- Check that `.env` file is in the project root

### Issue: Build errors
- **Solution**: Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (recommended: Node 18+)
- Ensure all dependencies are compatible

## Next Steps After Migration

1. ✅ Remove Lovable dependencies (completed)
2. ✅ Update hardcoded URLs (completed)
3. Set up your environment variables
4. Test the application locally
5. Set up your deployment pipeline (Vercel, Netlify, etc.)
6. Configure your production domain
7. Update Supabase Edge Functions with production URL
8. Test all features in production environment

## Deployment Options

The application can be deployed to any static hosting service:

- **Vercel**: Connect your Git repo and deploy
- **Netlify**: Connect your Git repo and deploy
- **Cloudflare Pages**: Connect your Git repo and deploy
- **Supabase Hosting**: If available in your plan
- **Any static host**: Build with `npm run build` and serve the `dist/` folder

Remember to set environment variables in your deployment platform's dashboard.

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev
- **Mapbox Docs**: https://docs.mapbox.com
- **shadcn/ui**: https://ui.shadcn.com

---

**Migration Status**: ✅ Complete
- Lovable dependencies removed
- Hardcoded URLs replaced with environment variables
- Documentation updated
