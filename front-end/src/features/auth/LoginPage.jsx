import useViewState from "../../shared/hooks/useViewState.js";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginThunk } from "./authSlice.js";
import usePageSetup from "../../shared/hooks/usePageSetup.js";
import { CSS, FONTS } from "../../shared/lib/pageAssets.js";
import AmbientGlow from "./components/AmbientGlow.jsx";
import LoginCard from "./components/LoginCard.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [username, setUsername] = useViewState("");
  const [password, setPassword] = useViewState("");
  const [rememberMe, setRememberMe] = useViewState(false);
  const [showPassword, setShowPassword] = useViewState(false);

  const [errorMessage, setErrorMessage] = useViewState(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("expired")
      ? "Your session ended. Please sign in again."
      : "",
  );
  const [isLoading, setIsLoading] = useViewState(false);
  const [isSuccess, setIsSuccess] = useViewState(false);
  const [fieldStatus, setFieldStatus] = useViewState({
    username: { error: false, shake: false },
    password: { error: false, shake: false },
  });

  usePageSetup({
    title: "BillBhai - Sign in",
    styles: [CSS.login],
    fonts: FONTS.auth,
  });

  const handleFieldFocus = (fieldName) => {
    setFieldStatus((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], error: false },
    }));
  };

  const handleShakeEnd = (fieldName) => {
    setFieldStatus((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], shake: false },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!username.trim()) {
      setFieldStatus({
        username: { error: true, shake: true },
        password: { error: false, shake: false },
      });
      return;
    }
    if (!password) {
      setFieldStatus({
        username: { error: false, shake: false },
        password: { error: true, shake: true },
      });
      return;
    }

    setIsLoading(true);

    try {
      let userData;
      try {
        userData = await dispatch(
          loginThunk({ username: username.trim(), password, rememberMe }),
        ).unwrap();
      } catch (err) {
        setFieldStatus((prev) => ({
          ...prev,
          password: { error: err.status === 401, shake: true },
        }));
        setErrorMessage(
          err.status === 401
            ? err.message && !/invalid username/i.test(err.message)
              ? err.message
              : "Incorrect username or password."
            : err.status === 0
              ? "Cannot reach the BillBhai server. Start the backend and try again."
              : err.message || "Sign-in failed. Please try again.",
        );
        setIsLoading(false);
        return;
      }

      const role = String(userData.role || "").toLowerCase();

      setIsLoading(false);
      setIsSuccess(true);

      setTimeout(() => {
        if (role === "superuser") navigate("/superuser");
        else if (role === "cashier" || role === "customer")
          navigate("/cashier");
        else if (role === "returnhandler") navigate("/returns");
        else if (role === "inventorymanager") navigate("/inventory");
        else if (role === "deliveryops") navigate("/delivery");
        else navigate("/dashboard");
      }, 600);
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage("Sign-in failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <>
      <AmbientGlow />
      <LoginCard
        username={username}
        password={password}
        rememberMe={rememberMe}
        showPassword={showPassword}
        fieldStatus={fieldStatus}
        errorMessage={errorMessage}
        isLoading={isLoading}
        isSuccess={isSuccess}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword(!showPassword)}
        onToggleRemember={() => setRememberMe(!rememberMe)}
        onForgotClick={() =>
          setErrorMessage(
            "Ask your shop admin to reset your password in Users, or if you are the business owner, contact support@billbhai.in from your registered email.",
          )
        }
        onFieldFocus={handleFieldFocus}
        onShakeEnd={handleShakeEnd}
        onSubmit={handleSubmit}
      />
    </>
  );
}
