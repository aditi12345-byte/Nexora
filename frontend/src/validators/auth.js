export function validateRegister({ name, email, password }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  if (password.length > 72) errors.password = 'Use 72 characters or fewer.';
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Enter your email.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}
