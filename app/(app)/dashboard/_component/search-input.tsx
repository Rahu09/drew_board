"use client";

import qs from "query-string";
import { Search } from "lucide-react";
import { useDebounceValue } from "usehooks-ts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useEffectEvent, useState } from "react";

import { Input } from "@/components/ui/input";

export const SearchInput = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");
  const [debouncedValue] = useDebounceValue(value, 500);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  // An effect event reads the latest URL without re-running the effect when
  // the URL changes (e.g. clicking "Favorite boards"), so only typing updates
  // the URL.
  const updateSearchParam = useEffectEvent((search: string) => {
    // Nothing typed since the URL was last set: don't navigate. This also
    // stops the first render from replacing ?favorites=true with the bare pathname.
    if (search === (searchParams.get("search") ?? "")) {
      return;
    }

    const url = qs.stringifyUrl(
      {
        url: pathname,
        // Keep the other params (like favorites) and only change search.
        query: { ...qs.parse(searchParams.toString()), search },
      },
      { skipEmptyString: true, skipNull: true }
    );

    router.push(url);
  });

  useEffect(() => {
    updateSearchParam(debouncedValue);
  }, [debouncedValue]);

  return (
    <div className="w-full relative">
      <Search className="absolute top-1/2 left-3 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        className="w-full max-w-[516px] pl-9"
        placeholder="Search boards"
        onChange={handleChange}
        value={value}
      />
    </div>
  );
};
