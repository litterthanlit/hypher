import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="marketing-root auth-screen">
      <div className="marketing-atmosphere" aria-hidden />
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
