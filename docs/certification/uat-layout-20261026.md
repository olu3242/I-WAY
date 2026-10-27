# UAT presentation repair

The hosted sign-in and password-setup pages previously returned bare HTML with no stylesheet. Their CSP also omitted styles, images, and fonts.

The UAT handler now serves a dedicated same-origin stylesheet, the existing approved logo, and Inter font. Sign-in and setup share a responsive card layout with stacked mobile sections, consistent field spacing, visible keyboard focus, and loading feedback. MFA replaces the credential fields and receives keyboard focus. Google remains a secondary option with its account-linking requirement stated.

Authentication, role checks, password handling, and MFA requirements remain enforced by the existing workflow. No account data or credentials are included in this change.

Browser coverage exercises synthetic setup, password sign-in, MFA, accessibility, and horizontal overflow at 320, 390, 768, and 1440 pixels. Real-user password sign-in requires the account holder and is not represented by these synthetic checks.
