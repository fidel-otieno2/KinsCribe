# 🔧 Troubleshooting: Account Creation Errors

## Common Error: "Registration failed"

### Possible Causes

1. **Email Already Registered**
   - Error: "This email is already registered. Please sign in."
   - Solution: Use the "Add Existing Account" button instead
   - Or: Use a different email address

2. **Username Already Taken for This Email**
   - Error: "This username is already taken for this email."
   - Solution: This means you already have an account with this username and email
   - Action: Use "Add Existing Account" to log in

3. **Google Account Conflict**
   - Error: "This email is linked to a Google account. Please sign in with Google."
   - Solution: Use Google Sign-In instead of creating a new account

4. **Network Error**
   - Error: "Registration failed" or "Network request failed"
   - Solution: Check internet connection
   - Action: Try again

5. **Backend Not Running**
   - Error: "Network request failed" or timeout
   - Solution: Ensure backend server is running
   - Check: `http://localhost:5000/api/auth/test`

## Debugging Steps

### Step 1: Check Console Logs
Open React Native debugger and look for:
```
📝 Creating account with: { name, username, email }
✅ Registration response: { ... }
```

Or error:
```
❌ Registration error: { error: "..." }
```

### Step 2: Test Backend Directly

**Test if backend is running:**
```bash
curl http://localhost:5000/api/auth/test
```

**Test registration:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "username": "testuser123",
    "email": "test123@example.com",
    "password": "password123"
  }'
```

Expected response (OTP enabled):
```json
{
  "message": "OTP sent to your email.",
  "requires_otp": true,
  "email": "test123@example.com"
}
```

Expected response (OTP disabled):
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { ... },
  "message": "Registered successfully.",
  "requires_otp": false
}
```

### Step 3: Check Username Availability

```bash
curl "http://localhost:5000/api/auth/username/check?username=testuser&email=test@example.com"
```

Response:
```json
{
  "available": true
}
```

or

```json
{
  "available": false,
  "error": "Username is already taken"
}
```

### Step 4: Check Email Configuration

If OTP is required but email fails:
```bash
curl "http://localhost:5000/api/auth/test-email?to=youremail@gmail.com"
```

## Common Scenarios

### Scenario 1: Creating First Account
```
✅ Fill form with unique email
✅ Username shows "available"
✅ Submit form
✅ Either:
   - OTP modal appears (if email configured)
   - Account created immediately (if no email)
✅ Navigate to SetupProfile
```

### Scenario 2: Creating Second Account (Multi-Account)
```
✅ Already logged in as Account A
✅ Open AccountSwitcher
✅ Tap "Create New Account"
✅ Use DIFFERENT email than Account A
✅ Fill form
✅ Submit
✅ Account B created
✅ Account A session preserved
✅ Can switch between accounts
```

### Scenario 3: Email Already Exists
```
❌ Email: john@example.com (already registered)
❌ Error: "This email is already registered"
✅ Solution: Use "Add Existing Account" instead
✅ Or: Use different email
```

### Scenario 4: Username Already Taken
```
❌ Username: johnsmith (already exists)
❌ Real-time check shows red X
❌ Error: "Username is already taken"
✅ Solution: Choose different username
✅ Real-time check will show green ✓
```

## Error Messages Explained

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| "All fields are required" | Missing name, username, email, or password | Fill all fields |
| "Password must be at least 6 characters" | Password too short | Use 6+ characters |
| "Username is already taken" | Username exists for this email | Choose different username |
| "This email is already registered" | Email already has an account | Use "Add Existing Account" |
| "This email is linked to a Google account" | Account uses Google Sign-In | Use Google button |
| "Registration failed" | Generic error | Check console logs |
| "Network request failed" | Can't reach backend | Check internet/backend |
| "Invalid invite code" | Wrong OTP entered | Check email for correct code |
| "Code has expired" | OTP older than 15 minutes | Request new code |

## Backend Error Codes

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| 400 | Bad request (validation error) | Fix form data |
| 409 | Conflict (email/username exists) | Use different email/username |
| 500 | Server error | Check backend logs |

## Validation Rules

### Email
- Must be valid email format
- Must not already exist in database
- Case-insensitive (john@example.com = JOHN@example.com)

### Username
- 3-30 characters
- Lowercase only
- Letters, numbers, underscore, period allowed
- No spaces
- Checked in real-time
- Same username can exist on different emails

### Password
- Minimum 6 characters
- No maximum
- Strength meter shows:
  - Red (< 6 chars): Too short
  - Orange (6-9 chars): Good
  - Green (10+ chars): Strong

### Name
- Required
- Any characters allowed
- Used for display

## Testing Checklist

Before reporting a bug, verify:

- [ ] Backend is running (`curl http://localhost:5000/api/auth/test`)
- [ ] Internet connection is working
- [ ] All form fields are filled
- [ ] Username shows "available" (green checkmark)
- [ ] Password is 6+ characters
- [ ] Email is not already registered
- [ ] Console shows no errors
- [ ] Using unique email (not already in database)

## Quick Fixes

### "Registration failed" with no details
1. Open React Native debugger
2. Look for console logs starting with 📝 or ❌
3. Check the error message
4. Follow solution for that specific error

### Username check not working
1. Wait 600ms after typing (debounced)
2. Check console for API call
3. Verify backend is running
4. Try different username

### OTP not received
1. Check spam folder
2. Verify email in backend logs
3. Check email configuration
4. Use test endpoint to verify email works

### Can't navigate to SetupProfile
1. Check console for navigation errors
2. Verify SetupProfile screen exists
3. Check navigation stack
4. Try restarting app

## Support

If issue persists:
1. Check console logs (📝 ✅ ❌ symbols)
2. Test backend directly with curl
3. Verify all validation rules
4. Check backend logs
5. Review error message carefully

## Example: Successful Registration

Console output should show:
```
📝 Creating account with: {
  name: "John Smith",
  username: "johnsmith",
  email: "john@example.com"
}
✅ Registration response: {
  requires_otp: true,
  message: "OTP sent to your email.",
  email: "john@example.com"
}
📧 OTP required, showing verification modal
```

Then after OTP:
```
✅ Account created, logging in
✅ Navigating to SetupProfile
```

---

**Most Common Issue**: Trying to register with an email that already exists.
**Solution**: Use "Add Existing Account" button instead of "Create New Account".

