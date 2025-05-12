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
    try {
    const { data: isAvailable, error: lookupError } = await supabase
      .rpc('check_email_availability', { p_email: email.trim() });

    if (lookupError) {
      console.error('Error checking email availability:', lookupError);
        // Continue with signup even if this check fails
        console.log('Continuing with signup despite email check failure');
      } else if (!isAvailable) {
      return {
        success: false,
        error: 'This email address is already registered. Please use a different email or sign in.'
      };
      }
    } catch (emailCheckError) {
      console.error('Exception during email availability check:', emailCheckError);
      // Continue with signup - we'll let the Auth API handle duplicate emails
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
        // Despite database error for profile creation, the auth user may have been created
        // Let's check if the user exists in auth
        try {
          const { data: userData } = await supabase.auth.getUser();
          
          if (userData?.user) {
            console.log('User exists in auth despite profile error, attempting manual profile creation');
            
            // Manually create the user profile since the trigger failed
            const { error: profileError } = await supabase
              .from('user_profiles')
              .insert({
                id: userData.user.id,
                email: userData.user.email,
                role: userData.user.app_metadata?.role || 'user'
              });
            
            if (profileError) {
              console.error('Manual profile creation failed:', profileError);
              // Continue anyway - the user has been created in auth system
            } else {
              console.log('Successfully created user profile manually');
            }
            
            return {
              success: true,
              user: userData.user,
              message: 'Account created successfully. You can now sign in.'
            };
          }
        } catch (getUserError) {
          console.error('Error checking user after signup failure:', getUserError);
        }
        
        return {
          success: false,
          error: 'Unable to create user profile. Please try again or contact support if the issue persists.'
        };
      }

      // Handle other common auth errors
      if (signUpError.message?.includes('already registered')) {
        return {
          success: false,
          error: 'This email address is already registered. Please use a different email or sign in.'
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

    // If we got here, the user was created in auth but we should check if profile creation was successful
    // Let's ensure the profile exists by checking/creating it
    try {
      // Check if profile exists
      const { data: profileData, error: profileCheckError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      
      if (profileCheckError) {
        console.error('Error checking for profile:', profileCheckError);
      }
      
      // If no profile found, create one
      if (!profileData) {
        console.log('No profile found, creating one manually');
        const { error: profileCreateError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            role: data.user.app_metadata?.role || 'user'
          });
        
        if (profileCreateError) {
          console.error('Error creating profile manually:', profileCreateError);
        } else {
          console.log('Profile created successfully');
        }
      }
    } catch (profileError) {
      console.error('Exception in profile handling:', profileError);
      // Continue anyway since the auth user was created
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