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

    // Step 2: Sign up the user with Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/merchant/signin`
      }
    });

    // Step 3: Handle signup errors
    if (signUpError) {
      console.error('Signup error:', signUpError);
      
      // Handle specific error cases
      if (signUpError.message?.includes('already registered')) {
        return {
          success: false,
          error: 'This email is already registered'
        };
      }

      return {
        success: false,
        error: signUpError.message || 'An error occurred during registration'
      };
    }

    // Step 4: Check signup response
    if (!data?.user) {
      return {
        success: false,
        error: 'User creation failed: No user data returned'
      };
    }

    // Step 5: Return success with confirmation message
    return {
      success: true,
      user: data.user,
      session: null, // Always null as we require email confirmation
      message: 'Please check your email to confirm your account before signing in.'
    };
    
  } catch (error) {
    console.error('User creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 