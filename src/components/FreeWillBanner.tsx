import { FREE_WILL_NOTE } from '../domain/loop';

export function FreeWillBanner() {
  return (
    <p className="free-will-banner" role="note">
      {FREE_WILL_NOTE}
    </p>
  );
}
