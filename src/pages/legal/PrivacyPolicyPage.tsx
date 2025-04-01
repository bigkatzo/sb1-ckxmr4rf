import { LegalPage } from '../../components/legal/LegalPage';

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Information We Collect</h2>
        <p className="text-gray-300 mb-4">We collect information that you provide directly to us, including:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Account information (username, email address)</li>
          <li>Transaction data</li>
          <li>Communication preferences</li>
          <li>Device and usage information</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">How We Use Your Information</h2>
        <p className="text-gray-300 mb-4">We use the information we collect to:</p>
        <ul className="list-disc pl-6 text-gray-300 space-y-2">
          <li>Process your transactions</li>
          <li>Provide customer support</li>
          <li>Send important updates</li>
          <li>Improve our services</li>
          <li>Prevent fraud</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Data Security</h2>
        <p className="text-gray-300">
          We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
        <p className="text-gray-300">
          If you have any questions about this Privacy Policy, please contact us at support@store.fun
        </p>
      </section>
    </LegalPage>
  );
}