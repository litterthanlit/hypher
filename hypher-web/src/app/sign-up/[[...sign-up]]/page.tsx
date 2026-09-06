import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="marketing-root auth-screen">
      <div className="marketing-atmosphere" aria-hidden />
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
