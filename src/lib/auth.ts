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

    // Step 2: Check if email already exists in user_profiles
    const { count, error: lookupError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.trim());

    if (lookupError) {
      console.error('Error checking for existing user:', lookupError);
      return {
        success: false,
        error: 'Unable to verify email availability. Please try again.'
      };
    }

    if (count && count > 0) {
      return {
        success: false,
        error: 'This email address is already registered. Please use a different email or sign in.'
      };
    }

    // Step 3: Sign up the user with Supabase Auth
    const isMerchantLocal = email.endsWith('@merchant.local');
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/merchant/signin`,
        data: {
          role: 'merchant',
          email_confirmed: isMerchantLocal // Auto-confirm merchant.local emails
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

    // Step 6: Return result based on email type and session
    if (isMerchantLocal || data.session) {
      // User is signed in immediately (merchant.local or no email confirmation required)
      return {
        success: true,
        user: data.user,
        session: data.session,
        message: 'Account created successfully. Redirecting to dashboard...'
      };
    } else {
      // Email confirmation is required for non-merchant.local addresses
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