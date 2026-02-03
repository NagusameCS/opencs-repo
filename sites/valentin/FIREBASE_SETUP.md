# Firebase Setup for Valentin 💕

## Quick Setup Guide

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Name it something like `valentin-matchmaking`
4. Disable Google Analytics (not needed) or enable if you want
5. Click "Create project"

### 2. Enable Realtime Database

1. In your Firebase project, go to **Build > Realtime Database**
2. Click "Create Database"
3. Choose a location close to your users (e.g., `us-central1`)
4. Start in **Test Mode** for now (we'll secure it later)
5. Click "Enable"

### 3. Get Your Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon `</>`
4. Register your app with a nickname like "valentin-web"
5. Copy the `firebaseConfig` object

### 4. Update script_firebase.js

Replace the config at the top of `script_firebase.js`:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

### 5. Secure Your Database (IMPORTANT!)

Once you're ready for production, update your **Database Rules**:

1. Go to **Realtime Database > Rules**
2. Replace with these rules:

```json
{
  "rules": {
    "valentin_submissions": {
      "$email": {
        ".read": "auth != null && auth.token.email.replace('.', '_') == $email",
        ".write": "auth != null && auth.token.email.endsWith('@asf.edu.mx')"
      }
    },
    ".read": false,
    ".write": false
  }
}
```

For development/testing, you can use more permissive rules:

```json
{
  "rules": {
    "valentin_submissions": {
      ".read": true,
      ".write": true
    }
  }
}
```

### 6. Optional: Enable Firebase Auth

If you want more secure authentication:

1. Go to **Build > Authentication**
2. Click "Get started"
3. Enable **Google** sign-in provider
4. Configure your OAuth consent screen
5. Add your domain to authorized domains

---

## How the Dual-Storage Works

The questionnaire now uses **dual storage**:

1. **Firebase (Primary)**: Data is stored in Firebase Realtime Database
2. **Local Server (Backup)**: Data is also sent to your existing server at `/sites/valentin/submit`

This ensures data is never lost even if one system fails.

### Firebase Data Structure

```
valentin_submissions/
├── user1_asf_edu_mx/
│   ├── email: "user1@asf.edu.mx"
│   ├── gender: "Female"
│   ├── age: 16
│   ├── grade: 11
│   ├── ... (all answers)
│   └── submittedAt: "2025-02-14T10:30:00.000Z"
├── user2_asf_edu_mx/
│   └── ...
```

---

## Reading Data (Admin/Matchmaking)

To read all submissions in your matchmaking code:

```javascript
// Initialize Firebase (same config as above)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Get all submissions
db.ref('valentin_submissions').once('value')
    .then(snapshot => {
        const submissions = [];
        snapshot.forEach(child => {
            submissions.push(child.val());
        });
        console.log('All submissions:', submissions);
        // Now you can run matchmaking algorithm
    });
```

---

## Costs

Firebase Realtime Database free tier includes:
- 1 GB stored
- 10 GB/month downloaded
- 100 simultaneous connections

For a school questionnaire, this is **more than enough** and completely free!

---

## Troubleshooting

### "Permission Denied" Error
- Check your database rules
- Make sure the user is authenticated if using auth rules

### Data Not Saving
- Check browser console for errors
- Verify Firebase config is correct
- Make sure `databaseURL` includes your project name

### Firebase Not Initializing
- Ensure Firebase SDK is loaded before your script
- Check for typos in your config
