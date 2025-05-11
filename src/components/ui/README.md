# UI Components

## ProfileImage

A robust and consistent profile image component that handles loading errors and provides fallback displays automatically. This should be used anywhere in the application that displays a user profile image.

### Features

- Consistent styling across the application
- Built-in error handling
- Automatic fallback to user initials if image fails to load
- Multiple size options
- Uses OptimizedImage component for better performance
- TypeScript support

### Usage

```jsx
import { ProfileImage } from '../ui/ProfileImage';

// Basic usage
<ProfileImage 
  src={user.profileImage} 
  alt={user.displayName} 
  displayName={user.displayName} 
/>

// With custom size
<ProfileImage 
  src={user.profileImage} 
  alt={user.displayName} 
  displayName={user.displayName}
  size="lg" 
/>

// With click handler
<ProfileImage 
  src={user.profileImage} 
  alt={user.displayName} 
  displayName={user.displayName}
  onClick={() => setShowProfileModal(true)} 
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| src | string \| null \| undefined | - | Image URL (required) |
| alt | string | - | Alt text for accessibility (required) |
| displayName | string | - | User display name (used for fallback initial) |
| size | 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' | 'md' | Size of the profile image |
| className | string | '' | Additional CSS classes |
| onClick | () => void | - | Click handler |
| priority | boolean | false | Priority for image loading |

### Size Reference

| Size | Dimensions | Use case |
|------|------------|----------|
| xs | 24×24px | Small UI elements like comments |
| sm | 32×32px | General list items |
| md | 40×40px | Standard profile display (default) |
| lg | 48×48px | Featured profiles |
| xl | 64×64px | Profile modals, detail pages | 