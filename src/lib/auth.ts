import { supabase } from './supabase';

interface CreateUserResult {
  success: boolean;
  user?: any;
  session?: any;
  message?: string;
  error?: string;
}

export async function createUser(email: string, password: string): Promise<CreateUserResult> {
  try {
    // Step 1: Sign up the user with Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/merchant/signin`
      }
    });

    // Step 2: Handle signup errors
    if (signUpError) {
      console.error('Signup error:', signUpError);
      if (signUpError.message?.includes('already registered')) {
        throw new Error('This email is already registered');
      }
      throw signUpError;
    }

    // Step 3: Check signup response
    if (!data?.user) {
      throw new Error('User creation failed: No user data returned');
    }

    // Step 4: Return result based on session
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