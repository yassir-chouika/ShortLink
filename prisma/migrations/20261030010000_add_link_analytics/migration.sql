ALTER TABLE "Link" ADD COLUMN "totalClicks" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Link" ADD CONSTRAINT "Link_totalClicks_check" CHECK ("totalClicks" >= 0);

CREATE TABLE "LinkClickDay" (
    "linkId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "clicks" BIGINT NOT NULL DEFAULT 1,
    CONSTRAINT "LinkClickDay_pkey" PRIMARY KEY ("linkId", "day"),
    CONSTRAINT "LinkClickDay_clicks_check" CHECK ("clicks" > 0),
    CONSTRAINT "LinkClickDay_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
