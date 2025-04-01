import { LegalPage } from '../../components/legal/LegalPage';

export function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
        <p className="text-gray-300">
          By accessing and using this website, you accept and agree to be bound by the terms and conditions of this agreement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. User Accounts</h2>
        <p className="text-gray-300 mb-4">When creating an account, you agree to:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Provide accurate information</li>
          <li>Maintain the security of your account</li>
          <li>Accept responsibility for all activities under your account</li>
          <li>Not share your account credentials</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">3. Intellectual Property</h2>
        <p className="text-gray-300">
          All content on this website, including text, graphics, logos, and software, is the property of MerchDotFun and is protected by copyright and other intellectual property laws.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">4. Prohibited Activities</h2>
        <p className="text-gray-300 mb-4">You agree not to:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Use the service for any illegal purpose</li>
          <li>Attempt to gain unauthorized access</li>
          <li>Interfere with the proper working of the service</li>
          <li>Engage in any automated use of the system</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">5. Contact</h2>
        <p className="text-gray-300">
          For any questions regarding these Terms, please contact us at support@store.fun
        </p>
      </section>
    </LegalPage>
  );
}