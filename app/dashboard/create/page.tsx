import { redirect } from 'next/navigation'

/**
 * The old multi-step creator here posted a fake bearer token and showed
 * placeholder script/video screens. The real, authenticated Shorts/long-form
 * workflow lives on the home page generator, so send everyone there.
 */
export default function CreateVideoRedirect() {
  redirect('/#generator')
}
