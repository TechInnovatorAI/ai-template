import Image from 'next/image';
import Link from 'next/link';

import {
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Lock,
  Sparkle,
} from 'lucide-react';

import { PricingTable } from '@kit/billing-gateway/marketing';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import billingConfig from '~/config/billing.config';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

function Home() {
  return (
    <div className={'mt-4 flex flex-col space-y-24 py-16'}>
      <div className={'container mx-auto flex flex-col space-y-20'}>
        <div
          className={
            'flex flex-col items-center md:flex-row' +
            ' mx-auto flex-1 justify-center animate-in fade-in' +
            ' duration-500 zoom-in-95 slide-in-from-top-24'
          }
        >
          <div
            className={
              'flex w-full flex-1 flex-col items-center space-y-8 xl:space-y-12 2xl:space-y-14'
            }
          >
            <Pill>AI Chatbots that don&apos;t suck</Pill>

            <div className={'flex flex-col items-center space-y-8'}>
              <HeroTitle>
                <span>AI Support Chatbots</span>

                <span>for your business</span>
              </HeroTitle>

              <div className={'flex flex-col'}>
                <Heading
                  level={2}
                  className={
                    'p-0 text-center font-sans text-2xl font-normal text-muted-foreground'
                  }
                >
                  <span>Innovative AI Chatbots for your business</span>
                </Heading>

                <Heading
                  level={2}
                  className={
                    'p-0 text-center font-sans text-2xl font-normal text-muted-foreground'
                  }
                >
                  <span>that will help you grow and scale</span>
                </Heading>

                <Heading
                  level={2}
                  className={
                    'p-0 text-center font-sans text-2xl font-normal text-muted-foreground'
                  }
                >
                  <span>your business to new heights</span>
                </Heading>
              </div>

              <MainCallToActionButton />
            </div>
          </div>
        </div>

        <div
          className={
            'mx-auto flex max-w-6xl justify-center py-12 animate-in fade-in ' +
            ' delay-300 duration-1000 slide-in-from-top-16 fill-mode-both'
          }
        >
          <Image
            priority
            className={
              'delay-250 rounded-lg border duration-1000 ease-out animate-in fade-in zoom-in-50 fill-mode-both'
            }
            width={1689}
            height={1057}
            src={`/images/dashboard-demo.webp`}
            alt={`App Image`}
          />
        </div>
      </div>

      <div className={'container mx-auto'}>
        <div
          className={
            'flex flex-col items-center justify-center space-y-16 py-16'
          }
        >
          <div className={'flex flex-col items-center space-y-8 text-center'}>
            <Pill>Get started for free. No credit card required.</Pill>

            <div className={'flex flex-col space-y-2'}>
              <Heading level={1}>
                Fair pricing for all types of businesses
              </Heading>

              <Heading
                level={2}
                className={'font-sans font-normal text-muted-foreground'}
              >
                Get started on our free plan and upgrade when you are ready.
              </Heading>
            </div>
          </div>

          <div className={'w-full'}>
            <PricingTable
              config={billingConfig}
              paths={{
                signUp: pathsConfig.auth.signUp,
                return: pathsConfig.app.home,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default withI18n(Home);

function HeroTitle({ children }: React.PropsWithChildren) {
  return (
    <h1
      className={
        'flex flex-col text-center font-heading text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl'
      }
    >
      {children}
    </h1>
  );
}

function Pill(props: React.PropsWithChildren) {
  return (
    <h2
      className={
        'rounded-full px-4 py-2 text-center text-sm text-muted-foreground shadow dark:shadow-primary/20'
      }
    >
      <Sparkle className={'inline-block h-4'} />
      {props.children}
    </h2>
  );
}

function FeatureShowcaseContainer(props: React.PropsWithChildren) {
  return (
    <div
      className={
        'flex flex-col items-center justify-between space-y-8 lg:flex-row lg:space-y-0' +
        ' lg:space-x-24'
      }
    >
      {props.children}
    </div>
  );
}

function FeatureContainer(
  props: React.PropsWithChildren<{
    className?: string;
    reverse?: boolean;
  }>,
) {
  return (
    <div
      className={cn('flex w-full flex-col space-y-6 lg:w-6/12', {
        'order-2 mt-8 lg:order-none lg:mt-0': props.reverse,
      })}
    >
      {props.children}
    </div>
  );
}

function MainCallToActionButton() {
  return (
    <div className={'flex space-x-2'}>
      <Button asChild variant={'link'}>
        <Link href={'/docs'}>
          <Trans i18nKey={'common:documentation'} />
        </Link>
      </Button>

      <Button asChild>
        <Link href={'/auth/sign-up'}>
          <span className={'flex items-center space-x-0.5'}>
            <span>
              <Trans i18nKey={'common:getStarted'} />
            </span>

            <ChevronRight
              className={
                'h-4 animate-in fade-in slide-in-from-left-8' +
                ' delay-800 duration-1000 zoom-in fill-mode-both'
              }
            />
          </span>
        </Link>
      </Button>
    </div>
  );
}

function IconContainer(
  props: React.PropsWithChildren<{
    className?: string;
  }>,
) {
  return (
    <div className={'flex'}>
      <span
        className={cn(
          'flex items-center justify-center rounded-lg p-3',
          props.className,
        )}
      >
        {props.children}
      </span>
    </div>
  );
}
