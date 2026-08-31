import { Composition, Folder } from "remotion";
import { HypherShowcaseIntro } from "./HypherShowcaseIntro";

export const RemotionRoot = () => {
  return (
    <Folder name="Hypher">
      <Composition
        id="HypherShowcaseIntro"
        component={HypherShowcaseIntro}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
  );
};
