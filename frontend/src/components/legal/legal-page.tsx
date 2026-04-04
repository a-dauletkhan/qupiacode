import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import "./legal-page.css"

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="April 4, 2026">
      <section>
        <h2>1. Information We Collect</h2>
        <p>
          When you create an account, we collect your email address and password
          (stored securely via our authentication provider). When you use the
          platform, we collect data about your projects, canvas objects, and
          collaboration activity.
        </p>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain the HigJam platform</li>
          <li>Enable real-time collaboration features</li>
          <li>Authenticate your identity and secure your account</li>
          <li>Improve our services and develop new features</li>
          <li>Send important service-related communications</li>
        </ul>
      </section>

      <section>
        <h2>3. Data Sharing</h2>
        <p>
          We do not sell your personal data. We may share information with
          third-party service providers that help us operate the platform (e.g.,
          hosting, authentication, real-time infrastructure). These providers are
          bound by contractual obligations to protect your data.
        </p>
      </section>

      <section>
        <h2>4. Data Storage &amp; Security</h2>
        <p>
          Your data is stored on secure cloud infrastructure. We use
          industry-standard encryption for data in transit and at rest. Access to
          production systems is restricted and audited.
        </p>
      </section>

      <section>
        <h2>5. Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          data at any time by contacting us. You may also export your project
          data or close your account.
        </p>
      </section>

      <section>
        <h2>6. Cookies</h2>
        <p>
          We use essential cookies and local storage to maintain your session and
          preferences. We do not use third-party tracking cookies.
        </p>
      </section>

      <section>
        <h2>7. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify you of
          material changes via the platform or email.
        </p>
      </section>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" updated="April 4, 2026">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using HigJam, you agree to be bound by these Terms of
          Use. If you do not agree, you may not use the platform.
        </p>
      </section>

      <section>
        <h2>2. Account Registration</h2>
        <p>
          You must provide accurate information when creating an account. You are
          responsible for maintaining the security of your credentials and for
          all activity under your account.
        </p>
      </section>

      <section>
        <h2>3. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the platform for unlawful purposes</li>
          <li>Attempt to gain unauthorized access to other accounts or systems</li>
          <li>Upload malicious content or interfere with platform operations</li>
          <li>Reverse-engineer, decompile, or disassemble any part of the service</li>
          <li>Resell or redistribute access to the platform without authorization</li>
        </ul>
      </section>

      <section>
        <h2>4. Intellectual Property</h2>
        <p>
          You retain ownership of all content you create on HigJam. By using the
          platform, you grant us a limited license to store, process, and
          display your content as necessary to provide the service.
        </p>
      </section>

      <section>
        <h2>5. Collaboration</h2>
        <p>
          When you share a project with other users, they may view, edit, or
          interact with its contents according to the permissions you set. You
          are responsible for managing access to your projects.
        </p>
      </section>

      <section>
        <h2>6. Service Availability</h2>
        <p>
          We strive for high availability but do not guarantee uninterrupted
          access. We may perform maintenance or updates that temporarily affect
          service availability.
        </p>
      </section>

      <section>
        <h2>7. Termination</h2>
        <p>
          We may suspend or terminate your account if you violate these terms.
          You may close your account at any time. Upon termination, your data
          may be deleted after a reasonable retention period.
        </p>
      </section>

      <section>
        <h2>8. Limitation of Liability</h2>
        <p>
          HigJam is provided "as is" without warranties of any kind. We are not
          liable for any indirect, incidental, or consequential damages arising
          from your use of the platform.
        </p>
      </section>

      <section>
        <h2>9. Changes to Terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the
          platform after changes constitutes acceptance of the updated terms.
        </p>
      </section>
    </LegalLayout>
  )
}

function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="legal-root">
      <div className="legal-container">
        <nav className="legal-nav">
          <Link to="/login" className="legal-back">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </nav>
        <header className="legal-header">
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">Last updated: {updated}</p>
        </header>
        <div className="legal-body">{children}</div>
      </div>
    </div>
  )
}
