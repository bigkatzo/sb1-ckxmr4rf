import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUser } from '../../lib/auth';
import { ShoppingBag, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';

export function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Enhanced validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !password || !confirmPassword) {
        throw new Error('Please fill in all fields');
      }
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and numbers');
      }

      // Create user using the auth utility
      const result = await createUser(email, password);

      if (!result.success) {
        throw new Error(result.error || 'An error occurred during registration');
      }

      setSuccess(result.message || '');
      if (result.session) {
        // User is signed in immediately
        navigate('/merchant/dashboard');
      } else {
        // Email confirmation required
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-primary transition-transform hover:scale-110">
            <ShoppingBag className="h-full w-full" />
          </div>
          <h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-extrabold text-gray-900">
            Create your merchant account
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Fill in your details to get started
          </p>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-3 sm:p-4 animate-fadeIn">
              <div className="flex items-start sm:items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <h3 className="text-xs sm:text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-3 sm:p-4 animate-fadeIn">
              <div className="flex items-start sm:items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                </div>
                <div className="ml-2 sm:ml-3">
                  <h3 className="text-xs sm:text-sm font-medium text-green-800">{success}</h3>
                </div>
              </div>
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-t-md relative block w-full px-3 py-2 sm:py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 text-sm sm:text-base transition-colors"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-3 py-2 sm:py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 text-sm sm:text-base transition-colors"
                  placeholder="Password (8+ chars, uppercase, lowercase, number)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="appearance-none rounded-b-md relative block w-full px-3 py-2 sm:py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 text-sm sm:text-base transition-colors"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm sm:text-base font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <Loading type={LoadingType.ACTION} text="Creating account..." />
              ) : (
                'Create account'
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => navigate('/merchant/signin')}
              className="text-xs sm:text-sm text-primary hover:text-primary-hover transition-colors focus:outline-none focus:underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 