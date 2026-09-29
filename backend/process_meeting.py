import os
import sys
import json

from faster_whisper import WhisperModel
from pyannote.audio import Pipeline


# =====================================================
# 0. WINDOWS UTF-8 OUTPUT
# =====================================================

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(
        encoding="utf-8",
        errors="replace"
    )

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(
        encoding="utf-8",
        errors="replace"
    )


# =====================================================
# 1. GET AUDIO FILE FROM COMMAND LINE
# =====================================================

if len(sys.argv) < 2:
    raise RuntimeError(
        "Audio file path is required.\n"
        "Usage: python process_meeting.py <audio_file>"
    )

AUDIO_FILE = os.path.abspath(sys.argv[1])

if not os.path.isfile(AUDIO_FILE):
    raise FileNotFoundError(
        f"Audio file not found: {AUDIO_FILE}"
    )

print(f"Input audio: {AUDIO_FILE}")


# =====================================================
# 2. HUGGING FACE TOKEN
# =====================================================

HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError(
        "HF_TOKEN is not set."
    )


# =====================================================
# 3. LOAD WHISPER
# =====================================================

print("Loading Whisper model...")

whisper_model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)

print("Whisper model loaded.")


# =====================================================
# 4. LOAD SPEAKER DIARIZATION
# =====================================================

print("Loading speaker diarization model...")

diarization_pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-community-1",
    token=HF_TOKEN,
)

print("Models loaded.")
print("Starting processing...")


# =====================================================
# 5. WHISPER TRANSCRIPTION
# =====================================================

print("\nTranscribing audio...")

segments, info = whisper_model.transcribe(
    AUDIO_FILE,
    language=None,
    task="transcribe",
    vad_filter=True
)

print(
    f"DETECTED LANGUAGE: {info.language} "
    f"(probability={info.language_probability:.2f})"
)


transcript_segments = []

for segment in segments:

    text = segment.text.strip()

    if not text:
        continue

    transcript_segments.append({
        "start": float(segment.start),
        "end": float(segment.end),
        "text": text
    })


print(
    f"Transcription completed. "
    f"Segments: {len(transcript_segments)}"
)


# =====================================================
# 6. SPEAKER DIARIZATION
# =====================================================

print("\nDetecting speakers...")

# Let pyannote detect the number of speakers automatically.
diarization = diarization_pipeline(
    AUDIO_FILE
)

speaker_segments = []


# Community-1 normally exposes speaker_diarization.
# Fallback keeps compatibility with other pyannote versions.
diarization_annotation = getattr(
    diarization,
    "speaker_diarization",
    diarization
)


for turn, _, speaker in diarization_annotation.itertracks(
    yield_label=True
):

    speaker_segments.append({
        "start": float(turn.start),
        "end": float(turn.end),
        "speaker": str(speaker)
    })


print(
    f"Speaker detection completed. "
    f"Segments: {len(speaker_segments)}"
)


# =====================================================
# 7. CALCULATE OVERLAP
# =====================================================

def overlap(
    a_start,
    a_end,
    b_start,
    b_end
):

    return max(
        0.0,
        min(a_end, b_end)
        - max(a_start, b_start)
    )


# =====================================================
# 8. MATCH TRANSCRIPT WITH SPEAKERS
# =====================================================

final_transcript = []

for segment in transcript_segments:

    best_speaker = "UNKNOWN"
    best_overlap = 0.0

    for speaker_segment in speaker_segments:

        current_overlap = overlap(
            segment["start"],
            segment["end"],
            speaker_segment["start"],
            speaker_segment["end"]
        )

        if current_overlap > best_overlap:

            best_overlap = current_overlap
            best_speaker = speaker_segment["speaker"]

    final_transcript.append({

        "start": segment["start"],

        "end": segment["end"],

        "speaker": best_speaker,

        "text": segment["text"]
    })


# =====================================================
# 9. CONVERT SPEAKER IDs
# =====================================================

speaker_map = {}

speaker_counter = 1

for item in final_transcript:

    speaker = item["speaker"]

    if speaker not in speaker_map:

        speaker_map[speaker] = (
            f"Speaker {speaker_counter}"
        )

        speaker_counter += 1

    item["speaker"] = speaker_map[speaker]


# =====================================================
# 10. FINAL HUMAN-READABLE TRANSCRIPT
# =====================================================

print("\n================================")
print("FINAL MEETING TRANSCRIPT")
print("================================\n")


for item in final_transcript:

    minutes = int(
        item["start"] // 60
    )

    seconds = int(
        item["start"] % 60
    )

    timestamp = (
        f"{minutes:02d}:{seconds:02d}"
    )

    print(
        f"[{timestamp}] "
        f"{item['speaker']}:"
    )

    print(item["text"])
    print()


# =====================================================
# 11. MACHINE-READABLE RESULT
# =====================================================

print("===JSON_RESULT_START===")

print(
    json.dumps(
        final_transcript,
        ensure_ascii=False
    )
)

print("===JSON_RESULT_END===")


# =====================================================
# 12. SUCCESS
# =====================================================

print(
    "Processing completed successfully."
)