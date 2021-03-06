/*
HTML escaping is the same as React's
(on purpose.) Therefore, it has the following Copyright and Licensing:

Copyright 2013-2014, Facebook, Inc.
All rights reserved.

This source code is licensed under the BSD-style license found in the LICENSE
file in the root directory of React's source tree.
*/

import {
  IntlConfig,
  IntlCache,
  CustomFormats,
  Formatters,
  IntlShape,
} from './types';
import * as React from 'react';
import {IntlMessageFormat, FormatXMLElementFn} from 'intl-messageformat';
import * as memoize from 'fast-memoize';
import {Cache} from 'fast-memoize';
import {invariant} from '@formatjs/intl-utils';
import {IntlRelativeTimeFormatOptions} from '@formatjs/intl-relativetimeformat';
import {UnsupportedFormatterError} from './error';

export function filterProps<T extends Record<string, any>, K extends string>(
  props: T,
  whitelist: Array<K>,
  defaults: Partial<T> = {}
): Pick<T, K> {
  return whitelist.reduce((filtered, name) => {
    if (name in props) {
      filtered[name] = props[name];
    } else if (name in defaults) {
      filtered[name] = defaults[name]!;
    }

    return filtered;
  }, {} as Pick<T, K>);
}

export function invariantIntlContext(intl?: any): asserts intl {
  invariant(
    intl,
    '[React Intl] Could not find required `intl` object. ' +
      '<IntlProvider> needs to exist in the component ancestry.'
  );
}

export const defaultErrorHandler: IntlShape['onError'] = error => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }
};

export const DEFAULT_INTL_CONFIG: Pick<
  IntlConfig,
  | 'formats'
  | 'messages'
  | 'timeZone'
  | 'textComponent'
  | 'defaultLocale'
  | 'defaultFormats'
  | 'onError'
> = {
  formats: {},
  messages: {},
  timeZone: undefined,
  textComponent: React.Fragment,

  defaultLocale: 'en',
  defaultFormats: {},

  onError: defaultErrorHandler,
};

export function createIntlCache(): IntlCache {
  return {
    dateTime: {},
    number: {},
    message: {},
    relativeTime: {},
    pluralRules: {},
    list: {},
    displayNames: {},
  };
}

function createFastMemoizeCache<V>(store: Record<string, V>): Cache<string, V> {
  return {
    create() {
      return {
        has(key) {
          return key in store;
        },
        get(key) {
          return store[key];
        },
        set(key, value) {
          store[key] = value;
        },
      };
    },
  };
}

// @ts-ignore this is to deal with rollup's default import shenanigans
const _memoizeIntl = memoize.default || memoize;
const memoizeIntl = _memoizeIntl as typeof memoize.default;

/**
 * Create intl formatters and populate cache
 * @param cache explicit cache to prevent leaking memory
 */
export function createFormatters(
  cache: IntlCache = createIntlCache()
): Formatters {
  const RelativeTimeFormat = (Intl as any).RelativeTimeFormat;
  const ListFormat = (Intl as any).ListFormat;
  const DisplayNames = (Intl as any).DisplayNames;
  const getDateTimeFormat = memoizeIntl(
    (...args) => new Intl.DateTimeFormat(...args),
    {
      cache: createFastMemoizeCache(cache.dateTime),
      strategy: memoizeIntl.strategies.variadic,
    }
  );
  const getNumberFormat = memoizeIntl(
    (...args) => new Intl.NumberFormat(...args),
    {
      cache: createFastMemoizeCache(cache.number),
      strategy: memoizeIntl.strategies.variadic,
    }
  );
  const getPluralRules = memoizeIntl(
    (...args) => new Intl.PluralRules(...args),
    {
      cache: createFastMemoizeCache(cache.pluralRules),
      strategy: memoizeIntl.strategies.variadic,
    }
  );
  return {
    getDateTimeFormat,
    getNumberFormat,
    getMessageFormat: memoizeIntl(
      (message, locales, overrideFormats, opts) =>
        new IntlMessageFormat(message, locales, overrideFormats, {
          formatters: {
            getNumberFormat,
            getDateTimeFormat,
            getPluralRules,
          },
          ...(opts || {}),
        }),
      {
        cache: createFastMemoizeCache(cache.message),
        strategy: memoizeIntl.strategies.variadic,
      }
    ),
    getRelativeTimeFormat: memoizeIntl(
      (...args) => new RelativeTimeFormat(...args),
      {
        cache: createFastMemoizeCache(cache.relativeTime),
        strategy: memoizeIntl.strategies.variadic,
      }
    ),
    getPluralRules,
    getListFormat: memoizeIntl((...args) => new ListFormat(...args), {
      cache: createFastMemoizeCache(cache.list),
      strategy: memoizeIntl.strategies.variadic,
    }),
    getDisplayNames: memoizeIntl((...args) => new DisplayNames(...args), {
      cache: createFastMemoizeCache(cache.displayNames),
      strategy: memoizeIntl.strategies.variadic,
    }),
  };
}

export function getNamedFormat<T extends keyof CustomFormats>(
  formats: CustomFormats,
  type: T,
  name: string,
  onError: IntlShape['onError']
):
  | Intl.NumberFormatOptions
  | Intl.DateTimeFormatOptions
  | IntlRelativeTimeFormatOptions
  | undefined {
  const formatType = formats && formats[type];
  let format;
  if (formatType) {
    format = formatType[name];
  }
  if (format) {
    return format;
  }

  onError(new UnsupportedFormatterError(`No ${type} format named: ${name}`));
}

/**
 * Takes a `formatXMLElementFn`, and composes it in function, which passes
 * argument `parts` through, assigning unique key to each part, to prevent
 * "Each child in a list should have a unique "key"" React error.
 * @param formatXMLElementFn
 */
export function assignUniqueKeysToParts(
  formatXMLElementFn: FormatXMLElementFn<React.ReactNode>
): typeof formatXMLElementFn {
  return function (parts) {
    // eslint-disable-next-line prefer-rest-params
    return formatXMLElementFn(React.Children.toArray(parts));
  };
}
