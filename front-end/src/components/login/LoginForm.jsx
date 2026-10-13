import InputField from './InputField.jsx';
import FormOptions from './FormOptions.jsx';
import LoginButton from './LoginButton.jsx';

export default function LoginForm({
  username,
  password,
  rememberMe,
  showPassword,
  fieldStatus,
  errorMessage,
  isLoading,
  isSuccess,
  onUsernameChange,
  onPasswordChange,
  onTogglePassword,
  onToggleRemember,
  onForgotClick,
  onFieldFocus,
  onShakeEnd,
  onSubmit,
}) {
  return (
    <form id="loginForm" className="login-form" autoComplete="off" onSubmit={onSubmit}>
      <InputField
        id="username"
        name="username"
        type="text"
        placeholder="Username / Email"
        icon="user"
        value={username}
        status={fieldStatus.username}
        onChange={onUsernameChange}
        onFocus={() => onFieldFocus('username')}
        onShakeEnd={() => onShakeEnd('username')}
      />
      <InputField
        id="password"
        name="password"
        type="password"
        placeholder="Password"
        icon="lock"
        value={password}
        status={fieldStatus.password}
        showPassword={showPassword}
        onChange={onPasswordChange}
        onFocus={() => onFieldFocus('password')}
        onShakeEnd={() => onShakeEnd('password')}
        onTogglePassword={onTogglePassword}
      />
      <FormOptions rememberMe={rememberMe} onToggleRemember={onToggleRemember} onForgotClick={onForgotClick} />
      <p className="login-error" id="loginError">{errorMessage}</p>
      <LoginButton isLoading={isLoading} isSuccess={isSuccess} />
    </form>
  );
}
