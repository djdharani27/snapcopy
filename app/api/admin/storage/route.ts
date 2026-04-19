import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/admin";
import { deleteS3Objects } from "@/lib/aws/s3";
import { deleteAllOrderFileRecords } from "@/lib/firebase/firestore-admin";

export async function DELETE() {
  try {
    await requireApiAdmin();
    const fileRecords = await deleteAllOrderFileRecords();

    const deletedS3ObjectCount = await deleteS3Objects(fileRecords.s3Keys);

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
