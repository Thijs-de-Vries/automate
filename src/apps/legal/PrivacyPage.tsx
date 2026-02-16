import React from 'react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-[var(--foreground)]">{title}</h2>
      <div className="text-[var(--muted)] leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            <span className="text-[var(--foreground)]">PRIVACY POLICY — </span>
            <span className="text-[var(--primary)]">AUTO-M8</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">Last updated: February 16, 2026</p>
        </div>

        <div className="grid gap-6">
          <Section title="WHAT IS THIS?">
            <p>
              This page explains what data Auto-M8 collects, why, and what we do with it.
              We try to keep it simple.
            </p>
          </Section>

          <Section title="WHO ARE WE?">
            <p>
              Auto-M8 is based in the Netherlands. If you have any questions about your data,
              email us at
              {' '}
              <a
                href="mailto:privacy@auto-m8.app"
                className="text-[var(--primary)] hover:underline"
              >
                privacy@auto-m8.app
              </a>
              .
            </p>
          </Section>

          <Section title="WHAT WE COLLECT">
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Your email address (to create your account, log you in, and send you 2FA codes)
              </li>
              <li>
                A device token (so we can send you push notifications)
              </li>
              <li>
                Crash and error reports (so we can fix bugs)
              </li>
            </ul>
            <p>
              That's it. We don't track how you use the app, we don't collect analytics,
              and we don't sell your data to anyone.
            </p>
          </Section>

          <Section title="SERVICES WE USE">
            <p>We use a few third-party services to make the app work:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Clerk — handles login and 2FA</li>
              <li>Convex — stores your data (our database)</li>
              <li>Sentry — collects crash/error reports so we can debug issues</li>
              <li>Expo & Firebase Cloud Messaging — deliver push notifications</li>
            </ul>
            <p>
              These companies only get the data they need to do their job. They're all US-based,
              which means your data leaves the EU. They operate under standard data protection agreements.
            </p>
          </Section>

          <Section title="YOUR RIGHTS">
            <p>You're in the EU, so you have rights under the GDPR. In short:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can ask us what data we have on you</li>
              <li>You can ask us to delete it</li>
              <li>You can ask us to correct it</li>
              <li>You can ask us to export it</li>
            </ul>
            <p>
              Just email
              {' '}
              <a
                href="mailto:privacy@auto-m8.app"
                className="text-[var(--primary)] hover:underline"
              >
                privacy@auto-m8.app
              </a>
              {' '}and we'll sort it out within 30 days.
            </p>
            <p>
              If you feel we're not handling your data properly, you can also file a complaint with the
              Dutch Data Protection Authority (Autoriteit Persoonsgegevens) at
              {' '}
              <a
                href="https://www.autoriteitpersoonsgegevens.nl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] hover:underline"
              >
                https://www.autoriteitpersoonsgegevens.nl
              </a>
              .
            </p>
          </Section>

          <Section title="ACCOUNT DELETION">
            <p>If you delete your account, we delete your data. Simple as that.</p>
          </Section>

          <Section title="CHANGES">
            <p>
              We may update this policy from time to time. The latest version will always be available at
              {' '}
              <a
                href="/privacy"
                className="text-[var(--primary)] hover:underline"
              >
                auto-m8.app/privacy
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
