import { Header } from '../components/Header';
import { LoginForm } from '../components/LoginForm';
import { SiteFooter } from '../components/SiteFooter';

export function LoginPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <LoginForm />
      </main>
      <SiteFooter />
    </>
  );
}
