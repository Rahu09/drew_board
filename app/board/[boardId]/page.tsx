"use client";

import { use } from "react";

import { Canvas } from "./_components/canvas";
import { Room } from "@/components/room";
import { Loading } from "./_components/loading";

interface BoardIdPageProps {
  // Next.js 15+ passes route params as a Promise.
  params: Promise<{
    boardId: string;
  }>;
}

const BoarIdPage = ({ params }: BoardIdPageProps) => {
  const { boardId } = use(params);

  return (
    <Room roomId={boardId} fallback={<Loading />}>
      <Canvas boardId={boardId} />
    </Room>
  );
};

export default BoarIdPage;
