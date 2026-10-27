-- CreateTable
CREATE TABLE "Link" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_code_key" ON "Link"("code");
