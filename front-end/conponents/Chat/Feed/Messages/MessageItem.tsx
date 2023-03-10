import { Avatar, Box, Flex, Stack, Text } from "@chakra-ui/react";
import { formatRelative } from "date-fns";
import enUS from "date-fns/locale/en-US";
import React from "react";
import { MessagePopulated } from "../../../../utils/types";

type Props = {
  message: MessagePopulated;
  sentByme: boolean;
};

const formatRelativeLocale = {
  lastWeek: "eeee 'at' p",
  yesterday: "'Yesterday at' p",
  today: "p",
  other: "MM/dd/yy",
};

const MessageItem = ({ message, sentByme }: Props) => {
  return (
    <Stack
      direction={"row"}
      p={4}
      spacing={4}
      _hover={{ bg: "whiteAlpha.200" }}
      wordBreak="break-word"
    //   border={"1px solid red"}
      justify={sentByme ? "flex-end" : "flex-start"}
    >
      {!sentByme && (
        <Flex align={"flex-end"}>
          <Avatar size={"sm"} />
        </Flex>
      )}
      <Stack spacing={1} width="100%">
        <Stack
          direction={"row"}
          align="center"
          justify={sentByme ? "flex-end" : "flex-start"}
        >
          {!sentByme && (
            <Text fontWeight={500} textAlign="left">
              {message.sender.username}
            </Text>
          )}
          <Text fontSize={14} color="whiteAlpha.700">
            {formatRelative(message.createdAt, new Date(), {
              locale: {
                ...enUS,
                formatRelative: (token) =>
                  formatRelativeLocale[
                    token as keyof typeof formatRelativeLocale
                  ],
              },
            })}
          </Text>
        </Stack>
        <Flex justify={sentByme ? "flex-end" : "flex-start"}>
          <Box
            bg={sentByme ? "brand.100" : "whiteAlpha.300"}
            px={2}
            py={1}
            borderRadius={12}
            maxWidth="65%"
          >
            <Text>{message.body}</Text>
          </Box>
        </Flex>
      </Stack>
    </Stack>
  );
};

export default MessageItem;
