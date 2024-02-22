"use client";

import { Plus } from "lucide-react";
import { CreateOrganization } from "@clerk/nextjs";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Hint } from "@/components/hints";

export const NewButton = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Hint
          label="Create organization"
          side="right"
          align="start"
          sideOffset={18}
        >
          <div className="aspect-square">
            <button className="bg-white/25 h-full w-full flex items-center justify-center opacity-60 rounded-md hover:opacity-100 transition">
              <Plus className="text-white" />
            </button>
          </div>
        </Hint>
      </DialogTrigger>
      <DialogContent className="p-0 bg-transparent border-none max-2-[480px]">
        <CreateOrganization />
      </DialogContent>
    </Dialog>
  );
};
