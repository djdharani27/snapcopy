import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import { deleteS3Objects, listAllS3Keys } from "@/lib/aws/s3";
import { deleteAllOrderFileRecords } from "@/lib/firebase/firestore-admin";

export async function DELETE() {
  try {
    await requireApiAdmin();
    const [bucketKeys, fileRecords] = await Promise.all([
      listAllS3Keys(),
      deleteAllOrderFileRecords(),
    ]);

    const deletedS3ObjectCount = await deleteS3Objects(bucketKeys);

    return NextResponse.json({
      success: true,
      deletedS3ObjectCount,
      deletedFileRecordCount: fileRecords.deletedFileRecordCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to clear storage." },
      { status: 400 },
    );
  }
}
