# 🎨 Account Creation Flow - Visual Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCOUNT SWITCHER SCREEN                              │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  👤 John Smith (@johnsmith)                          ✓ Active        │  │
│  │  📧 john@example.com                                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  👤 Jane Doe (@janedoe)                              ⟳ Switch        │  │
│  │  📧 jane@example.com                                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │  ➕ Add Existing Account                                             │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  👤➕ Create New Account                          [PURPLE GRADIENT]  │  │ ◄── TAP HERE
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CREATE NEW ACCOUNT MODAL (STEP 1)                       │
│                                                                              │
│  ✨ Create New Account                                              ✕       │
│  Join the KinsCribe family                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Full Name                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 👤  John Smith                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Username                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ @  johnsmith                                                    ✓    │  │ ◄── Real-time check
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ✓ Username is available                                                    │
│                                                                              │
│  Email                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ✉️  john@example.com                                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Password                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🔒  ••••••••••••                                                👁️   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ████████████░░░░  Strong                                                   │ ◄── Strength meter
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              [GRADIENT] Create Account                               │  │ ◄── TAP TO SUBMIT
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  By signing up you agree to our Terms of Service and Privacy Policy        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │  POST /auth/register  │
                          │  Backend Processing   │
                          └───────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
          ┌──────────────────┐              ┌──────────────────┐
          │  OTP Required    │              │  No OTP Needed   │
          │  requires_otp:   │              │  Returns tokens  │
          │  true            │              │  & user data     │
          └──────────────────┘              └──────────────────┘
                    │                                   │
                    ▼                                   │
┌─────────────────────────────────────────────────────┐│
│     CREATE NEW ACCOUNT MODAL (STEP 2 - OTP)        ││
│                                                     ││
│  ← Verify Email                              ✕     ││
│  Check your inbox                                   ││
│  ─────────────────────────────────────────────────  ││
│                                                     ││
│  ✉️                                                 ││
│  [PURPLE GRADIENT ICON]                             ││
│                                                     ││
│  Check your email                                   ││
│  We sent a 6-digit code to john@example.com        ││
│                                                     ││
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐             ││
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │             ││ ◄── OTP Input
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘             ││
│                                                     ││
│  ┌─────────────────────────────────────────────┐  ││
│  │      [GRADIENT] Verify Email                │  ││ ◄── TAP TO VERIFY
│  └─────────────────────────────────────────────┘  ││
│                                                     ││
│  Didn't get it? Resend code (60s)                  ││ ◄── Cooldown timer
│                                                     ││
└─────────────────────────────────────────────────────┘│
                    │                                   │
                    ▼                                   │
          ┌──────────────────┐                         │
          │ POST /auth/      │                         │
          │ verify-otp       │                         │
          └──────────────────┘                         │
                    │                                   │
                    └───────────────┬───────────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │  registerNewAccount()         │
                    │  - Save current session       │
                    │  - Store new tokens           │
                    │  - Set as active account      │
                    │  - Update user state          │
                    │  - Add to saved accounts      │
                    └───────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SETUP PROFILE SCREEN                                 │
│                                                                              │
│  Step 1 of 5                                                                │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │                          📸                                          │  │
│  │                    [UPLOAD PHOTO]                                    │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Add a profile photo                                                        │
│  Help your family and connections recognize you                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              [GRADIENT] Save & Continue                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Skip for now                                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          POST /auth/avatar
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2 of 5: Profile Info                                                  │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                              │
│  Username: @johnsmith                                                       │
│  Bio: Family man, tech enthusiast (150 chars)                              │
│  Website: https://johnsmith.com                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          PUT /auth/profile
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3 of 5: Interests                                                     │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                              │
│  [👨👩👧 Family] [✈️ Travel] [🍽️ Food] [💪 Fitness]                      │
│  [🎵 Music] [📸 Photography] [🌿 Nature] [📜 History]                      │
│  [👨🍳 Cooking] [🎨 Art] [⚽ Sports] [💻 Tech]                             │
│                                                                              │
│  3 selected (✓)                                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          PUT /auth/profile
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4 of 5: Privacy                                                       │
│  ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🌍  Public Account                                              ⦿    │  │
│  │     Anyone can see your posts and follow you                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🔒  Private Account                                             ○    │  │
│  │     Only approved followers can see your posts                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          PUT /auth/profile
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5 of 5: People you may know                                           │
│  ████████████████████████████████████████████████████████████████████████  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 👤 Sarah Johnson (@sarahjohnson)                    [Connect]        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 👤 Mike Wilson (@mikewilson)                        [Connect]        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              [GRADIENT] Continue (2 connected)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Skip for now                                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    GET /connections/suggestions
                    POST /connections/{userId}/toggle
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  refreshUser()   │
                          │  GET /auth/me    │
                          └──────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │  navigation.reset()       │
                    │  → Main App (Feed)        │
                    └───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FEED SCREEN                                     │
│                                                                              │
│  🎉 Welcome to KinsCribe, John!                                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Stories                                                             │  │
│  │  [Your Story] [Sarah] [Mike] [Emma]                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  👨👩👧 Your Family                                                  │  │
│  │  Stories, memories & moments                                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Your Feed                                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  [Posts from connections...]                                                │
│                                                                              │
│  ✅ Account Created Successfully!                                           │
│  ✅ Profile Set Up!                                                         │
│  ✅ Ready to Use KinsCribe!                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Multi-Account Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-ACCOUNT MANAGEMENT                             │
│                                                                              │
│  Current User: John Smith (@johnsmith)                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Saved Accounts in AsyncStorage:                                     │  │
│  │                                                                      │  │
│  │  1. John Smith (@johnsmith) ← ACTIVE                                │  │
│  │     - access_token: eyJhbGc...                                       │  │
│  │     - refresh_token: eyJhbGc...                                      │  │
│  │     - last_active: 2024-01-01T12:00:00Z                             │  │
│  │                                                                      │  │
│  │  2. Jane Doe (@janedoe)                                             │  │
│  │     - access_token: eyJhbGc...                                       │  │
│  │     - refresh_token: eyJhbGc...                                      │  │
│  │     - last_active: 2024-01-01T10:00:00Z                             │  │
│  │                                                                      │  │
│  │  3. [NEW] Mike Wilson (@mikewilson) ← JUST CREATED                  │  │
│  │     - access_token: eyJhbGc...                                       │  │
│  │     - refresh_token: eyJhbGc...                                      │  │
│  │     - last_active: 2024-01-01T12:30:00Z                             │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Actions:                                                                   │
│  • Switch to any account instantly                                          │
│  • Add more accounts (existing or new)                                      │
│  • Remove accounts                                                          │
│  • Each account has separate data                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 State Flow Diagram

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ AccountSwitcherScreen State              │
│                                           │
│ • showCreateModal: false → true          │
│ • createStep: 1                           │
│ • createForm: { name, username, ... }    │
│ • usernameStatus: null → checking →      │
│   available/taken                         │
│ • createLoading: false → true → false    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ API Call: POST /auth/register            │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Response Handler                          │
│                                           │
│ If OTP Required:                          │
│   • createStep: 1 → 2                    │
│   • Show OTP modal                        │
│                                           │
│ If No OTP:                                │
│   • Call registerNewAccount()             │
│   • Navigate to SetupProfile              │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ AuthContext State Update                  │
│                                           │
│ • user: null → newUserData               │
│ • savedAccounts: [...old, newAccount]   │
│ • AsyncStorage updated                    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ SetupProfileScreen                        │
│                                           │
│ • step: 1 → 2 → 3 → 4 → 5                │
│ • Each step updates profile               │
│ • Final step calls done()                 │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Navigation Reset                          │
│                                           │
│ • Clear navigation stack                  │
│ • Navigate to Main → Feed                 │
│ • User sees welcome screen                │
└───────────────────────────────────────────┘
```

---

## 🎯 Success Indicators

```
✅ User taps "Create New Account"
  └─ Modal opens with form

✅ User fills form
  └─ Real-time validation works
  └─ Username check shows status
  └─ Password strength updates

✅ User submits form
  └─ Loading spinner shows
  └─ API call succeeds
  └─ OTP modal appears (if needed)

✅ User enters OTP
  └─ 6 boxes auto-focus
  └─ Verification succeeds
  └─ Account created

✅ registerNewAccount() called
  └─ Tokens stored
  └─ User state updated
  └─ Account added to list

✅ Navigate to SetupProfile
  └─ 5 steps complete
  └─ Profile data saved
  └─ User data refreshed

✅ Navigate to Main App
  └─ Feed screen loads
  └─ User is logged in
  └─ Can use all features

✅ Multi-account works
  └─ Can switch accounts
  └─ Each account separate
  └─ Sessions preserved
```

---

**Visual Flow Complete!** 🎨
