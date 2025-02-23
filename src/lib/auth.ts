import { supabase } from './supabase';
import { validateEmail, validatePassword } from './validation';

interface CreateUserResult {
  success: boolean;
  user?: any;
  session?: any;
  message?: string;
  error?: string;
}

export async function createUser(email: string, password: string): Promise<CreateUserResult> {
  try {
    // Step 1: Validate inputs
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return {
        success: false,
        error: emailValidation.error
      };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: passwordValidation.error
      };
    }

    // Step 2: Check if email is available using the new function
    const { data: isAvailable, error: lookupError } = await supabase
      .rpc('check_email_availability', { p_email: email.trim() });

    if (lookupError) {
      console.error('Error checking email availability:', lookupError);
      return {
        success: false,
        error: 'Unable to verify email availability. Please try again.'
      };
    }

    if (!isAvailable) {
      return {
        success: false,
        error: 'This email address is already registered. Please use a different email or sign in.'
      };
    }

    // Step 3: Sign up the user with Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/merchant/signin`,
        data: {
          role: 'user' // Default role for new users
        }
      }
    });

    // Step 4: Handle signup errors
    if (signUpError) {
      console.error('Signup error:', signUpError);
      
      if (signUpError.message?.includes('Database error')) {
        return {
          success: false,
          error: 'Unable to create user profile. Please try again.'
        };
      }

      return {
        success: false,
        error: signUpError.message || 'An error occurred during registration'
      };
    }

    // Step 5: Check signup response
    if (!data?.user) {
      return {
        success: false,
        error: 'User creation failed: No user data returned'
      };
    }

    // Step 6: Return result based on session state
    if (data.session) {
      // User is signed in immediately (no email confirmation required)
      return {
        success: true,
        user: data.user,
        session: data.session,
        message: 'Account created successfully. Redirecting to dashboard...'
      };
    } else {
      // Email confirmation is required
      return {
        success: true,
        user: data.user,
        session: null,
        message: 'Please check your email to confirm your account before signing in.'
      };
    }
  } catch (error) {
    console.error('User creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 