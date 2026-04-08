/**
 * Format backend errors into user-friendly messages
 */
export const formatErrorMessage = (error, defaultMessage = 'Something went wrong') => {
  // Handle server errors (500, 502, 503, 504)
  if ([500, 502, 503, 504].includes(error.response?.status)) {
    return 'We\'re experiencing technical difficulties. Our team has been notified and is working on it. Thank you for your patience!';
  }
  
  // Handle network errors
  if (!error.response) {
    return 'Unable to connect to server. Please check your internet connection.';
  }
  
  // Handle validation errors from backend
  const data = error.response?.data;
  
  if (data) {
    // Handle specific field errors
    if (typeof data === 'object') {
      const messages = [];
      
      // Email errors
      if (data.email) {
        const emailError = Array.isArray(data.email) ? data.email[0] : data.email;
        
        if (emailError.includes('already registered') || emailError.includes('already exists')) {
          messages.push('This email is already in use. Please use a different email or sign in.');
        } else if (emailError.includes('invalid')) {
          messages.push('Please enter a valid email address.');
        } else {
          messages.push(emailError);
        }
      }
      
      // Username errors
      if (data.username) {
        const usernameError = Array.isArray(data.username) ? data.username[0] : data.username;
        
        if (usernameError.includes('already') || usernameError.includes('exists')) {
          messages.push('This username is already taken. Please choose another one.');
        } else {
          messages.push(usernameError);
        }
      }
      
      // Password errors
      if (data.password) {
        const passwordError = Array.isArray(data.password) ? data.password[0] : data.password;
        
        if (passwordError.includes('match')) {
          messages.push('Passwords do not match. Please try again.');
        } else if (passwordError.includes('short') || passwordError.includes('length')) {
          messages.push('Password is too short. Please use at least 8 characters.');
        } else {
          messages.push(passwordError);
        }
      }
      
      // Generic detail field
      if (data.detail) {
        const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        
        if (detail.includes('verify')) {
          messages.push(detail);
        } else if (detail.includes('invalid') || detail.includes('incorrect')) {
          messages.push('Invalid credentials. Please check your information and try again.');
        } else {
          messages.push(detail);
        }
      }
      
      // Return combined messages or default
      return messages.length > 0 ? messages.join(' ') : defaultMessage;
    }
    
    // Handle string responses
    if (typeof data === 'string') {
      if (data.includes('verify')) {
        return data;
      } else if (data.includes('invalid') || data.includes('incorrect')) {
        return 'Invalid credentials. Please check your information and try again.';
      }
      return data;
    }
  }
  
  // Handle authentication errors
  if (error.response?.status === 401) {
    return 'Invalid email/username or password. Please try again.';
  }
  
  if (error.response?.status === 403) {
    if (data?.requires_verification) {
      return 'Please verify your email before logging in. Check your inbox for the verification code.';
    }
    return 'Access denied. You don\'t have permission to perform this action.';
  }
  
  if (error.response?.status === 404) {
    return 'The requested resource was not found.';
  }
  
  return defaultMessage;
};
