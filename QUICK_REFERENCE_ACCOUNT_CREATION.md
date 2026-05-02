# 🚀 Quick Reference: Create New Account Feature

## For Developers

### 📍 Key Files

```
Frontend:
├── /mobile/src/screens/AccountSwitcherScreen.js  ← Main implementation
├── /mobile/src/screens/SetupProfileScreen.js     ← Profile setup wizard
└── /mobile/src/context/AuthContext.js            ← Multi-account logic

Backend:
├── /backend/routes/auth_routes.py                ← Auth endpoints
└── /backend/routes/connection_routes.py          ← Suggestions endpoint
```

### 🔌 API Endpoints

```javascript
// Registration
POST /auth/register
Body: { name, username, email, password }

// OTP Verification
POST /auth/verify-otp
Body: { email, otp }

// Resend OTP
POST /auth/resend-otp
Body: { email }

// Username Check
GET /auth/username/check?username={username}&email={email}

// Profile Update
PUT /auth/profile
Body: { bio, website, interests, is_private }

// Upload Avatar
POST /auth/avatar
Body: FormData with file

// Get User
GET /auth/me

// Suggestions
GET /connections/suggestions

// Follow/Unfollow
POST /connections/{userId}/toggle
```

### 🎯 Key Functions

```javascript
// AuthContext
registerNewAccount(userData, accessToken, refreshToken)
  → Saves current session
  → Stores new account
  → Sets as active
  → Updates state

// AccountSwitcherScreen
handleCreateAccount()
  → Validates form
  → Calls /auth/register
  → Shows OTP modal if needed
  → Calls registerNewAccount()
  → Navigates to SetupProfile

handleVerifyOtp()
  → Validates OTP
  → Calls /auth/verify-otp
  → Calls registerNewAccount()
  → Navigates to SetupProfile

checkUsername(username)
  → Debounced (600ms)
  → Calls /auth/username/check
  → Updates usernameStatus state
```

### 📊 State Variables

```javascript
// AccountSwitcherScreen
const [showCreateModal, setShowCreateModal] = useState(false);
const [createStep, setCreateStep] = useState(1); // 1: form, 2: otp
const [createForm, setCreateForm] = useState({
  name: '',
  username: '',
  email: '',
  password: ''
});
const [usernameStatus, setUsernameStatus] = useState(null);
// null | 'checking' | 'available' | 'taken'
const [otp, setOtp] = useState(['', '', '', '', '', '']);
const [resendCooldown, setResendCooldown] = useState(0);
```

### 🎨 Styling Classes

```javascript
// Key styles
s.createBtn          // Purple gradient button
s.inputWrap          // Input container
s.strengthRow        // Password strength bars
s.otpBox            // OTP input box
s.errorBox          // Error message container
s.usernameErr       // Username error text
s.usernameOk        // Username success text
```

### 🔄 User Flow

```
AccountSwitcher
  → Tap "Create New Account"
  → Fill form (with real-time validation)
  → Submit
  → [OTP verification if enabled]
  → registerNewAccount()
  → SetupProfile (5 steps)
  → Main App (Feed)
```

### ✅ Testing Commands

```bash
# Test registration
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","username":"testuser","email":"test@example.com","password":"password123"}'

# Test username check
curl "http://localhost:5000/auth/username/check?username=testuser&email=test@example.com"

# Test OTP verification
curl -X POST http://localhost:5000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

### 🐛 Common Issues

**Issue**: Username check not working
**Fix**: Check debounce function and API endpoint

**Issue**: OTP modal not appearing
**Fix**: Verify `requires_otp` in backend response

**Issue**: Navigation not working
**Fix**: Check navigation.reset() call in SetupProfile

**Issue**: Multi-account not saving
**Fix**: Verify AsyncStorage keys and registerNewAccount()

### 📝 Code Snippets

**Add new validation**:
```javascript
if (!createForm.email.includes('@')) {
  return setCreateError('Invalid email format');
}
```

**Add new OTP input box**:
```javascript
<TextInput
  ref={r => otpRefs.current[idx] = r}
  style={s.otpBox}
  value={otp[idx]}
  onChangeText={v => handleOtpChange(v, idx)}
  keyboardType="number-pad"
  maxLength={1}
/>
```

**Add new profile step**:
```javascript
// In SetupProfileScreen.js
{step === 6 && <NewStep onNext={next} />}
```

### 🔧 Configuration

**Enable/Disable OTP**:
Backend: Set email service configuration

**Change cooldown timer**:
```javascript
setResendCooldown(60); // Change to desired seconds
```

**Modify password requirements**:
```javascript
if (createForm.password.length < 8) { // Change minimum
  return setCreateError('Password must be at least 8 characters');
}
```

### 📱 Platform-Specific

**iOS**:
```javascript
<KeyboardAvoidingView behavior="padding">
```

**Android**:
```javascript
<KeyboardAvoidingView behavior="height">
```

### 🎯 Quick Checklist

Before deploying:
- [ ] Test registration flow
- [ ] Test OTP verification
- [ ] Test username validation
- [ ] Test password strength
- [ ] Test multi-account
- [ ] Test profile setup
- [ ] Test navigation
- [ ] Test error handling
- [ ] Test on iOS
- [ ] Test on Android

### 📚 Documentation

- `ACCOUNT_CREATION_FLOW.md` - Technical details
- `ACCOUNT_CREATION_VERIFICATION.md` - Backend integration
- `ACCOUNT_CREATION_VISUAL_FLOW.md` - Visual diagrams
- `ACCOUNT_CREATION_COMPLETE.md` - Executive summary

### 🆘 Need Help?

1. Check console logs
2. Review error messages
3. Verify backend endpoints
4. Check AsyncStorage data
5. Test network connectivity
6. Review documentation files

---

**Quick Start**: Open AccountSwitcherScreen.js and search for "Create New Account" to see the implementation.

**Status**: ✅ Production Ready
